import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree
from xml.sax.saxutils import escape

import httpx

from app.domain.numbers import normalize_brand, normalize_number
from app.suppliers.base import Offer, PartGroup, SupplierError, SupplierResult
from app.suppliers.ratelimit import RateLimiter

NS = "https://api.rossko.ru/"
MOSCOW = timezone(timedelta(hours=3))
NOT_FOUND = "Ничего не найдено"
BAD_RESPONSE = "Росско вернул непонятный ответ"

URL = "https://api.rossko.ru/service/v2.1/GetSearch"
TIMEOUT = 15.0

_Q = f"{{{NS}}}"
_log = logging.getLogger("app.suppliers")

_ENVELOPE = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"'
    f' xmlns:r="{NS}"><soap:Body><r:GetSearch>'
    "<r:KEY1>{key1}</r:KEY1><r:KEY2>{key2}</r:KEY2><r:text>{text}</r:text>"
    "<r:delivery_id>{delivery_id}</r:delivery_id><r:address_id>{address_id}</r:address_id>"
    "</r:GetSearch></soap:Body></soap:Envelope>"
)


def _text(el: ElementTree.Element, tag: str) -> str:
    return (el.findtext(f"{_Q}{tag}") or "").strip()


def _moscow(value: str) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=MOSCOW)


def _offer(stock: ElementTree.Element) -> Offer:
    code = _text(stock, "type")
    delivery = _text(stock, "delivery")
    price = Decimal(_text(stock, "price"))
    if not price.is_finite() or price <= 0:
        raise ValueError("bad price")
    return Offer(
        warehouse=_text(stock, "description"),
        qty=int(_text(stock, "count")),
        multiplicity=int(_text(stock, "multiplicity") or "1"),
        delivery_days=int(delivery) if delivery else None,
        delivery_from=_moscow(_text(stock, "deliveryStart")),
        delivery_to=_moscow(_text(stock, "deliveryEnd")),
        kind="normal" if code == "0" else "other",
        kind_code=code,
        purchase_price=price,
    )


def _add(
    groups: dict[tuple[str, str], PartGroup],
    seen: dict[tuple[str, str], set[str]],
    el: ElementTree.Element,
    requested: bool,
    parent: str | None = None,
) -> None:
    brand = _text(el, "brand")
    number = _text(el, "partnumber")
    key = (normalize_brand(brand), normalize_number(number))
    group = groups.get(key)
    if group is None:
        group = PartGroup(
            brand=brand,
            number=number,
            number_norm=key[1],
            name=_text(el, "name"),
            is_requested=requested,
            offers=[],
            key=f"{key[0]}|{key[1]}",
            analog_of=[],
        )
        groups[key] = group
        seen[key] = set()
    elif requested:
        group.is_requested = True
    if parent is not None and not group.is_requested and parent not in group.analog_of:
        group.analog_of.append(parent)
    for stock in el.findall(f"{_Q}stocks/{_Q}stock"):
        stock_id = _text(stock, "id")
        if stock_id and stock_id in seen[key]:
            continue
        seen[key].add(stock_id)
        group.offers.append(_offer(stock))


def parse_search(xml: bytes) -> SupplierResult:
    try:
        root = ElementTree.fromstring(xml)
        result = root.find(f".//{_Q}SearchResult")
        if result is None:
            raise SupplierError(BAD_RESPONSE)
        message = _text(result, "message") or None
        if _text(result, "success").lower() != "true":
            if message == NOT_FOUND:
                return SupplierResult(groups=[], message=None)
            raise SupplierError(message or "Росско вернул ошибку")

        groups: dict[tuple[str, str], PartGroup] = {}
        seen: dict[tuple[str, str], set[str]] = {}
        tops = result.findall(f"{_Q}PartsList/{_Q}Part")
        for top in tops:
            _add(groups, seen, top, requested=True)
        for top in tops:
            brand = normalize_brand(_text(top, "brand"))
            parent = f"{brand}|{normalize_number(_text(top, 'partnumber'))}"
            for cross in top.findall(f"{_Q}crosses/{_Q}Part"):
                _add(groups, seen, cross, requested=False, parent=parent)
        return SupplierResult(groups=list(groups.values()), message=message)
    except (ElementTree.ParseError, ValueError, InvalidOperation) as exc:
        raise SupplierError(BAD_RESPONSE) from exc


class RosskoSupplier:
    code = "rossko"
    title = "Росско"

    def __init__(
        self,
        key1: str,
        key2: str,
        delivery_id: str,
        address_id: str,
        limiter: RateLimiter | None = None,
    ) -> None:
        self._key1 = key1
        self._key2 = key2
        self._delivery_id = delivery_id
        self._address_id = address_id
        self._limiter = limiter or RateLimiter(300, 60)

    async def search(self, number: str) -> SupplierResult:
        started = time.monotonic()
        try:
            result = await self._search(number)
        except SupplierError as exc:
            self._log(number, exc.message, started)
            raise
        self._log(number, "ok", started)
        return result

    def _log(self, number: str, outcome: str, started: float) -> None:
        _log.info(
            "supplier=%s number=%r outcome=%s duration_ms=%d",
            self.code,
            number,
            outcome,
            (time.monotonic() - started) * 1000,
        )

    async def _search(self, number: str) -> SupplierResult:
        if not self._key1 or not self._key2:
            raise SupplierError("Росско не настроен")
        if not self._limiter.try_acquire():
            raise SupplierError("Лимит запросов к Росско, повторите через минуту")
        body = _ENVELOPE.format(
            key1=escape(self._key1),
            key2=escape(self._key2),
            text=escape(number),
            delivery_id=escape(self._delivery_id),
            address_id=escape(self._address_id),
        )
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": f'"{NS}GetSearch"',
        }
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(URL, content=body.encode(), headers=headers)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise SupplierError(f"Росско не ответил за {TIMEOUT:g} с") from None
        except httpx.HTTPError:
            raise SupplierError("Росско недоступен, повторите позже") from None
        return parse_search(response.content)
