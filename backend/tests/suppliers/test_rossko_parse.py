from datetime import datetime
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree

import pytest

from app.domain.numbers import normalize_brand, normalize_number
from app.suppliers.base import SupplierError
from app.suppliers.rossko import MOSCOW, NS, parse_search

FIXTURES = Path(__file__).parent.parent / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / f"rossko_search_{name}.xml").read_bytes()


def wrap(parts: str, message: str | None = None) -> bytes:
    msg = f"<ns1:message>{message}</ns1:message>" if message else ""
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"'
        ' xmlns:ns1="https://api.rossko.ru/"><SOAP-ENV:Body><ns1:GetSearchResponse>'
        f"<ns1:SearchResult><ns1:success>true</ns1:success>{msg}"
        f"<ns1:PartsList>{parts}</ns1:PartsList>"
        "</ns1:SearchResult></ns1:GetSearchResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>"
    ).encode()


def part(brand: str, number: str, stocks: str = "", crosses: str = "") -> str:
    st = f"<ns1:stocks>{stocks}</ns1:stocks>" if stocks else ""
    cr = f"<ns1:crosses>{crosses}</ns1:crosses>" if crosses else ""
    return (
        f"<ns1:Part><ns1:brand>{brand}</ns1:brand><ns1:partnumber>{number}</ns1:partnumber>"
        f"<ns1:name>n</ns1:name>{st}{cr}</ns1:Part>"
    )


def stock(sid: str, type_: str = "0", extra: str = "") -> str:
    return (
        f"<ns1:stock><ns1:id>{sid}</ns1:id><ns1:price>100.5</ns1:price><ns1:count>2</ns1:count>"
        f"<ns1:multiplicity>1</ns1:multiplicity><ns1:type>{type_}</ns1:type>"
        f"<ns1:delivery>3</ns1:delivery><ns1:description>W</ns1:description>{extra}</ns1:stock>"
    )


def test_parse_w683_requested_groups() -> None:
    result = parse_search(load("w683"))
    requested = [g for g in result.groups if g.is_requested]
    assert [(g.brand, g.number) for g in requested] == [("MGA", "W683"), ("Mann", "W 68/3")]
    assert len(requested[1].offers) == 3
    assert [g.number_norm for g in requested] == ["W683", "W683"]


def test_parse_w683_offer_fields() -> None:
    result = parse_search(load("w683"))
    group = next(g for g in result.groups if g.brand == "Metelli" and g.number == "24-0683")
    offer = group.offers[0]
    assert offer.warehouse == "Партнерский склад"
    assert offer.qty == 1
    assert offer.multiplicity == 1
    assert offer.delivery_days == 1
    assert offer.delivery_from == datetime(2026, 10, 22, 16, 30, tzinfo=MOSCOW)
    assert offer.delivery_to == datetime(2026, 10, 22, 19, 30, tzinfo=MOSCOW)
    assert offer.kind == "normal"
    assert offer.kind_code == "0"
    assert offer.purchase_price == Decimal("2630")


def _key(brand: str, number: str) -> tuple[str, str]:
    return normalize_brand(brand), normalize_number(number)


def test_parse_333114_dedups_crosses() -> None:
    raw = load("333114")
    result = parse_search(raw)
    root = ElementTree.fromstring(raw)
    q = f"{{{NS}}}"
    requested_keys = set()
    cross_keys = set()
    for p in root.iter(f"{q}PartsList"):
        for top in p.findall(f"{q}Part"):
            requested_keys.add(
                _key(top.findtext(f"{q}brand", ""), top.findtext(f"{q}partnumber", ""))
            )
            for c in top.findall(f"{q}crosses/{q}Part"):
                cross_keys.add(_key(c.findtext(f"{q}brand", ""), c.findtext(f"{q}partnumber", "")))
    expected = cross_keys - requested_keys
    analogs = [g for g in result.groups if not g.is_requested]
    assert len(analogs) == len(expected)
    assert {_key(g.brand, g.number) for g in analogs} == expected
    # offers unique per stock id: compare counts with unique ids in raw XML
    ids_by_key: dict[tuple[str, str], set[str]] = {}
    for top in root.iter(f"{q}Part"):
        k = _key(top.findtext(f"{q}brand", ""), top.findtext(f"{q}partnumber", ""))
        for s in top.findall(f"{q}stocks/{q}stock"):
            ids_by_key.setdefault(k, set()).add(s.findtext(f"{q}id", ""))
    for g in result.groups:
        assert len(g.offers) == len(ids_by_key.get(_key(g.brand, g.number), set()))


def test_cross_equal_to_requested_merges_into_it() -> None:
    cross = part("Kyb", "333-114", stock("B"))
    xml = wrap(part("KYB", "333114", stock("A"), cross))
    result = parse_search(xml)
    assert len(result.groups) == 1
    group = result.groups[0]
    assert group.is_requested
    assert len(group.offers) == 2


def test_not_found_is_empty() -> None:
    result = parse_search(load("not_found"))
    assert result.groups == []
    assert result.message is None


def test_error_raises_with_rossko_message() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_search(load("error"))
    assert exc.value.message == "Неверный ключ"


def test_unknown_type_and_missing_delivery() -> None:
    result = parse_search(wrap(part("A", "1", stock("X", type_="3"))))
    offer = result.groups[0].offers[0]
    assert offer.kind == "other"
    assert offer.kind_code == "3"
    assert offer.delivery_from is None
    assert offer.delivery_to is None
    assert offer.delivery_days == 3
    assert offer.purchase_price == Decimal("100.5")


def test_message_passed_through() -> None:
    result = parse_search(wrap(part("A", "1", stock("X")), "Аналоги не подключены"))
    assert result.message == "Аналоги не подключены"


def test_broken_xml_raises() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_search(b"<oops")
    assert exc.value.message == "Росско вернул непонятный ответ"


def test_parse_w683_analog_of() -> None:
    result = parse_search(load("w683"))
    requested = {"MGA|W683", "MANN|W683"}
    by_key = {g.key: g for g in result.groups}
    assert set(g.key for g in result.groups if g.is_requested) == requested
    assert by_key["MANN|W683"].analog_of == []
    assert by_key["MGA|W683"].analog_of == []
    analogs = [g for g in result.groups if not g.is_requested]
    assert analogs
    for g in analogs:
        assert g.analog_of
        assert set(g.analog_of) <= requested
    metelli = next(g for g in analogs if g.brand.lower() == "metelli" and g.number_norm == "240683")
    assert metelli.analog_of == ["MGA|W683"]


def test_analog_of_two_parents() -> None:
    shared = part("Metelli", "24-0683")
    xml = wrap(
        part("MGA", "W683", crosses=shared)
        + part("Mann", "W 68/3", crosses=shared + part("Bosch", "F 1"))
    )
    groups = {g.key: g for g in parse_search(xml).groups}
    assert groups["METELLI|240683"].analog_of == ["MGA|W683", "MANN|W683"]
    assert groups["BOSCH|F1"].analog_of == ["MANN|W683"]


def test_cross_with_brand_suffix_joins_requested_group() -> None:
    xml = wrap(
        part("MGA", "W683", crosses=part("MANN-FILTER", "W 68/3", stock("S1")))
        + part("MANN", "W683", stock("S2"))
    )
    groups = {g.key: g for g in parse_search(xml).groups}
    assert "MANN|W683" in groups
    assert {o.stock_id for o in groups["MANN|W683"].offers} == {"S1", "S2"}


@pytest.mark.parametrize("price", ["NaN", "Infinity", "-Infinity", "0", "-5"])
def test_parse_rejects_non_finite_or_non_positive_price(price: str) -> None:
    st = stock("1").replace("<ns1:price>100.5</ns1:price>", f"<ns1:price>{price}</ns1:price>")
    with pytest.raises(SupplierError):
        parse_search(wrap(part("B", "1", st)))


def test_offer_has_stock_id() -> None:
    result = parse_search(load("333114"))
    group = next(g for g in result.groups if g.key == "KYB|333114")
    assert "HST1498810258" in {o.stock_id for o in group.offers}
