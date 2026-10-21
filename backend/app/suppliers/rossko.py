from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree

from app.domain.numbers import normalize_brand, normalize_number
from app.suppliers.base import Offer, PartGroup, SupplierError, SupplierResult

NS = "https://api.rossko.ru/"
MOSCOW = timezone(timedelta(hours=3))
NOT_FOUND = "Ничего не найдено"
BAD_RESPONSE = "Росско вернул непонятный ответ"

_Q = f"{{{NS}}}"


def _text(el: ElementTree.Element, tag: str) -> str:
    return (el.findtext(f"{_Q}{tag}") or "").strip()


def _moscow(value: str) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=MOSCOW)


def _offer(stock: ElementTree.Element) -> Offer:
    code = _text(stock, "type")
    delivery = _text(stock, "delivery")
    return Offer(
        warehouse=_text(stock, "description"),
        qty=int(_text(stock, "count")),
        multiplicity=int(_text(stock, "multiplicity") or "1"),
        delivery_days=int(delivery) if delivery else None,
        delivery_from=_moscow(_text(stock, "deliveryStart")),
        delivery_to=_moscow(_text(stock, "deliveryEnd")),
        kind="normal" if code == "0" else "other",
        kind_code=code,
        purchase_price=Decimal(_text(stock, "price")),
    )


def _add(
    groups: dict[tuple[str, str], PartGroup],
    seen: dict[tuple[str, str], set[str]],
    el: ElementTree.Element,
    requested: bool,
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
        )
        groups[key] = group
        seen[key] = set()
    elif requested:
        group.is_requested = True
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
            for cross in top.findall(f"{_Q}crosses/{_Q}Part"):
                _add(groups, seen, cross, requested=False)
        return SupplierResult(groups=list(groups.values()), message=message)
    except (ElementTree.ParseError, ValueError, InvalidOperation) as exc:
        raise SupplierError(BAD_RESPONSE) from exc
