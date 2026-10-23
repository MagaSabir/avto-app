import asyncio
import logging
import re
import time
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree

import httpx

from app.domain.brands import canonical_brand, part_key
from app.domain.numbers import normalize_number
from app.suppliers.base import (
    CartLine,
    Offer,
    OfferKind,
    PartGroup,
    SupplierError,
    SupplierResult,
    SupplierVariants,
)
from app.suppliers.ratelimit import RateLimiter

NS = "http://mikado-parts.ru/service"
BAD_RESPONSE = "Микадо вернул непонятный ответ"
AUTH_ERROR = "Микадо: ошибка авторизации"
ORDER_WAREHOUSE = "Под заказ"
VARIANTS_WAREHOUSE = "Варианты поставки"

URL = "https://mikado-parts.ru/ws1/service.asmx/{method}"
TIMEOUT = 15.0
# Mikado allows 2000 Code_Search + Code_Info calls a day; keep a margin
DAILY_LIMIT = 1500
MOSCOW = timezone(timedelta(hours=3))
FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"

_Q = f"{{{NS}}}"
_log = logging.getLogger("app.suppliers")
_BRAND_SUFFIX = re.compile(r"\s*\[[^\]]*\]$")
_DAYS = re.compile(r"(\d+)\s*дн")
_REQUESTED_TYPES = ("Aftermarket", "OEM")


def _text(el: ElementTree.Element, tag: str) -> str:
    return (el.findtext(f"{_Q}{tag}") or "").strip()


def _price(value: str) -> Decimal:
    price = Decimal(value)
    if not price.is_finite() or price <= 0:
        raise ValueError("bad price")
    return price


def _qty(value: str) -> tuple[int, bool]:
    # "10" is "more than 10" on the Mikado site; "N+" is also an open-ended count
    if value == "10":
        return 10, True
    if value.endswith("+"):
        return int(value[:-1]), True
    return int(value), False


def _multiplicity(value: str) -> int:
    return int(value) if value.isdigit() and int(value) > 0 else 1


def _opt_int(el: ElementTree.Element, tag: str) -> int | None:
    value = _text(el, tag)
    return int(value) if value else None


def _lenient_int(el: ElementTree.Element, tag: str) -> int | None:
    try:
        return _opt_int(el, tag)
    except ValueError:
        return None


def _search_offers(row: ElementTree.Element) -> list[Offer]:
    code = _text(row, "ZakazCode").lower()
    kind_code = _text(row, "CodeType")
    multiplicity = _multiplicity(_text(row, "MinZakazQTY"))
    price = _price(_text(row, "PriceRUR"))
    stocks = row.findall(f"{_Q}OnStocks/{_Q}StockLine")
    if stocks:
        offers = []
        for stock in stocks:
            qty, plus = _qty(_text(stock, "StockQTY"))
            offers.append(
                Offer(
                    warehouse=_text(stock, "StokName"),
                    stock_id=f"{code}|{_text(stock, 'StokID')}",
                    qty=qty,
                    qty_plus=plus,
                    multiplicity=multiplicity,
                    delivery_days=_opt_int(stock, "DeliveryDelay"),
                    delivery_from=None,
                    delivery_to=None,
                    kind="normal",
                    kind_code=kind_code,
                    purchase_price=price,
                    order_code=code,
                )
            )
        return offers
    srock = _text(row, "Srock")
    days = _DAYS.search(srock)
    kind: OfferKind
    if days:
        kind, warehouse, delivery = (
            "order",
            _BRAND_SUFFIX.sub("", _text(row, "Supplier")),
            int(days.group(1)),
        )
    elif srock == "?":
        kind, warehouse, delivery = "variants", VARIANTS_WAREHOUSE, None
    else:
        raise ValueError("no stock and no delivery time")
    return [
        Offer(
            warehouse=warehouse,
            stock_id=code,
            qty=0,
            multiplicity=multiplicity,
            delivery_days=delivery,
            delivery_from=None,
            delivery_to=None,
            kind=kind,
            kind_code=kind_code,
            purchase_price=price,
            order_code=code,
        )
    ]


def parse_search(xml: bytes, number: str) -> SupplierResult:
    try:
        root = ElementTree.fromstring(xml)
        if root.tag != f"{_Q}Code_List":
            raise SupplierError(BAD_RESPONSE)
        groups: dict[str, PartGroup] = {}
        seen: dict[str, set[str]] = {}
        # per analog group: (brand of the requested part it belongs to, last requested key so far)
        owner: dict[str, tuple[str, str | None]] = {}
        last_requested: str | None = None
        for row in root.findall(f"{_Q}List/{_Q}Code_List_Row"):
            kind_code = _text(row, "CodeType")
            if kind_code == "NotDefined":
                continue
            try:
                offers = _search_offers(row)
            except (ValueError, InvalidOperation):
                continue
            brand = _text(row, "ProducerBrand")
            code = _text(row, "ProducerCode")
            norm = normalize_number(code)
            key = part_key(brand, norm)
            group = groups.get(key)
            if group is None:
                group = PartGroup(
                    brand=brand,
                    number=code,
                    number_norm=norm,
                    name=_text(row, "Name"),
                    is_requested=False,
                    offers=[],
                    key=key,
                    analog_of=[],
                )
                groups[key] = group
                seen[key] = set()
            if kind_code in _REQUESTED_TYPES:
                group.is_requested = True
                last_requested = key
            elif key not in owner:
                owner[key] = (canonical_brand(_text(row, "Brand")), last_requested)
            for offer in offers:
                if offer.stock_id in seen[key]:
                    continue
                seen[key].add(offer.stock_id)
                group.offers.append(offer)
        requested = [key for key, group in groups.items() if group.is_requested]
        for key, group in groups.items():
            if group.is_requested:
                continue
            # an analog row's Brand is the brand of the requested part it belongs to
            brand, fallback = owner[key]
            matched = [k for k in requested if canonical_brand(groups[k].brand) == brand]
            group.analog_of = matched or ([fallback] if fallback else list(requested))
        return SupplierResult(groups=list(groups.values()), message=None)
    except ElementTree.ParseError as exc:
        raise SupplierError(BAD_RESPONSE) from exc


def parse_stock_info(xml: bytes) -> list[Offer]:
    try:
        root = ElementTree.fromstring(xml)
        if root.tag != f"{_Q}CodeBrandResult":
            raise SupplierError(BAD_RESPONSE)
        message = _text(root, "Message")
        if message != "Ok":
            if "авторизации" in message:
                raise SupplierError(AUTH_ERROR)
            detail = message.strip(" ;\n")
            raise SupplierError(f"Микадо: {detail}" if detail else BAD_RESPONSE)
        offers = []
        for line in root.findall(f"{_Q}List/{_Q}CodeBrandLine"):
            try:
                price = _price(_text(line, "PriceRUR"))
                qty, plus = _qty(_text(line, "StockQTY"))
            except (ValueError, InvalidOperation):
                continue
            code = _text(line, "OrderCode").lower()
            offers.append(
                Offer(
                    warehouse=_text(line, "StokName"),
                    stock_id=f"{code}|{_text(line, 'StokID')}",
                    qty=qty,
                    qty_plus=plus,
                    multiplicity=_multiplicity(_text(line, "MinZakazQTY")),
                    delivery_days=_opt_int(line, "DeliveryDelay"),
                    delivery_from=None,
                    delivery_to=None,
                    kind="normal",
                    kind_code="",
                    purchase_price=price,
                    order_code=code,
                )
            )
        return offers
    except ElementTree.ParseError as exc:
        raise SupplierError(BAD_RESPONSE) from exc


def parse_info(xml: bytes, order_code: str) -> SupplierVariants:
    try:
        root = ElementTree.fromstring(xml)
        if root.tag != f"{_Q}Code_Info_Block":
            raise SupplierError(BAD_RESPONSE)
        code = order_code.lower()
        kind_code = _text(root, "CodeType")
        offers = []
        for info in root.findall(f"{_Q}Prices/{_Q}Code_PriceInfo"):
            try:
                price = _price(_text(info, "PriceRUR"))
                stock = info.find(f"{_Q}OnStocks/{_Q}StockLine")
                qty, plus = _qty(_text(stock, "StockQTY")) if stock is not None else (0, False)
                delivery_type = _text(info, "DeliveryType")
                offers.append(
                    Offer(
                        warehouse=_text(stock, "StokName")
                        if stock is not None
                        else ORDER_WAREHOUSE,
                        stock_id=f"{code}#{delivery_type}" if delivery_type else code,
                        qty=qty,
                        qty_plus=plus,
                        multiplicity=1,
                        delivery_days=_opt_int(info, "Srock"),
                        delivery_from=None,
                        delivery_to=None,
                        kind="normal" if stock is not None else "order",
                        kind_code=kind_code,
                        purchase_price=price,
                        delivery_days_max=_lenient_int(info, "SrockMax"),
                        rating=_lenient_int(info, "Rating"),
                        order_code=code,
                    )
                )
            except (ValueError, InvalidOperation):
                continue
        return SupplierVariants(offers=offers, message=_text(root, "Message") or None)
    except ElementTree.ParseError as exc:
        raise SupplierError(BAD_RESPONSE) from exc


class DailyLimit:
    """In-memory counter of limited Mikado calls per Moscow calendar day."""

    def __init__(
        self,
        limit: int = DAILY_LIMIT,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._limit = limit
        self._clock = clock
        self._day: date | None = None
        self._count = 0

    def try_acquire(self) -> bool:
        today = self._clock().astimezone(MOSCOW).date()
        if today != self._day:
            self._day, self._count = today, 0
        if self._count >= self._limit:
            return False
        self._count += 1
        return True


def _fixture(name: str) -> bytes:
    return (FIXTURES / f"mikado_{name}.xml").read_bytes()


class MikadoSupplier:
    code = "mikado"
    title = "Микадо"

    def __init__(
        self,
        client_id: str,
        password: str,
        *,
        limiter: RateLimiter | None = None,
        daily: DailyLimit | None = None,
        fake: bool = False,
    ) -> None:
        self._client_id = client_id
        self._password = password
        self._limiter = limiter or RateLimiter(60, 60)
        self._daily = daily or DailyLimit()
        self._fake = fake

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        if self._fake:
            return parse_search(
                _fixture("search_orders" if with_orders else "search_stock"), number
            )
        data = {
            "Search_Code": number,
            "FromStockOnly": "FromStockAndByOrder" if with_orders else "FromStockOnly",
        }
        return parse_search(await self._call("Code_Search", number, data, limited=True), number)

    async def variants(self, order_code: str) -> SupplierVariants:
        if self._fake:
            return parse_info(_fixture("info_oem"), order_code)
        body = await self._call("Code_Info", order_code, {"ZakazCode": order_code}, limited=True)
        return parse_info(body, order_code)

    async def check_offers(self, lines: list[CartLine]) -> dict[str, Offer | None]:
        """Re-check cart lines: warehouse lines via stock info, the rest via Code_Info."""
        by_pair: dict[tuple[str, str], list[CartLine]] = {}
        by_code: dict[str, list[CartLine]] = {}
        for line in lines:
            if "|" in line.stock_id:
                key = (normalize_number(line.number), line.brand)
                by_pair.setdefault(key, []).append(line)
            else:
                code = line.order_code or line.stock_id.split("#")[0]
                by_code.setdefault(code, []).append(line)
        pairs = list(by_pair.values())
        codes = list(by_code.items())
        stock_offers = await asyncio.gather(
            *(self._stock_info(g[0].number, g[0].brand) for g in pairs)
        )
        infos = await asyncio.gather(*(self.variants(code) for code, _ in codes))
        found: dict[str, Offer | None] = {}
        for group, offers in zip(pairs, stock_offers, strict=True):
            by_id = {o.stock_id: o for o in offers}
            for line in group:
                found[line.stock_id] = by_id.get(line.stock_id)
        for (_, group), info in zip(codes, infos, strict=True):
            by_id = {o.stock_id: o for o in info.offers}
            for line in group:
                found[line.stock_id] = by_id.get(line.stock_id)
        return found

    async def _stock_info(self, number: str, brand: str) -> list[Offer]:
        """CodeBrandStockInfo: Mikado warehouses only, not counted in the daily limit."""
        if self._fake:
            return parse_stock_info(_fixture("cbsi"))
        body = await self._call(
            "CodeBrandStockInfo", number, {"Code": number, "Brand": brand}, limited=False
        )
        return parse_stock_info(body)

    async def _call(self, method: str, number: str, data: dict[str, str], limited: bool) -> bytes:
        started = time.monotonic()
        try:
            body = await self._post(method, data, limited)
        except SupplierError as exc:
            self._log(method, number, exc.message, started)
            raise
        self._log(method, number, "ok", started)
        return body

    def _log(self, method: str, number: str, outcome: str, started: float) -> None:
        _log.info(
            "supplier=%s method=%s number=%r outcome=%s duration_ms=%d",
            self.code,
            method,
            number,
            outcome,
            (time.monotonic() - started) * 1000,
        )

    async def _post(self, method: str, data: dict[str, str], limited: bool) -> bytes:
        if not self._client_id or not self._password:
            raise SupplierError("Микадо не настроен")
        if not self._limiter.try_acquire():
            raise SupplierError("Лимит запросов к Микадо, повторите через минуту")
        if limited and not self._daily.try_acquire():
            raise SupplierError("Лимит запросов к Микадо на сегодня исчерпан")
        form = {**data, "ClientID": self._client_id, "Password": self._password}
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(URL.format(method=method), data=form)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise SupplierError(f"Микадо не ответил за {TIMEOUT:g} с") from None
        except httpx.HTTPError:
            raise SupplierError("Микадо недоступен, повторите позже") from None
        return response.content
