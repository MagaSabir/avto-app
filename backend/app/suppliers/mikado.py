import re
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree

from app.domain.brands import part_key
from app.domain.numbers import normalize_number
from app.suppliers.base import (
    Offer,
    PartGroup,
    SupplierError,
    SupplierResult,
    SupplierVariants,
)

NS = "http://mikado-parts.ru/service"
BAD_RESPONSE = "Микадо вернул непонятный ответ"
AUTH_ERROR = "Микадо: ошибка авторизации"
ORDER_WAREHOUSE = "Под заказ"
VARIANTS_WAREHOUSE = "Варианты поставки"

_Q = f"{{{NS}}}"
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
            kind="order" if kind == "order" else "variants",
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
            for offer in offers:
                if offer.stock_id in seen[key]:
                    continue
                seen[key].add(offer.stock_id)
                group.offers.append(offer)
        requested = [key for key, group in groups.items() if group.is_requested]
        for group in groups.values():
            if not group.is_requested:
                group.analog_of = list(requested)
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
                        delivery_days_max=_opt_int(info, "SrockMax"),
                        rating=_opt_int(info, "Rating"),
                        order_code=code,
                    )
                )
            except (ValueError, InvalidOperation):
                continue
        return SupplierVariants(offers=offers, message=_text(root, "Message") or None)
    except ElementTree.ParseError as exc:
        raise SupplierError(BAD_RESPONSE) from exc
