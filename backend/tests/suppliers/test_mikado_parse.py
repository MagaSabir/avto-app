from decimal import Decimal
from pathlib import Path

import pytest

from app.suppliers.base import PartGroup, SupplierError
from app.suppliers.mikado import parse_info, parse_search, parse_stock_info

FIXTURES = Path(__file__).parent.parent / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / f"mikado_{name}.xml").read_bytes()


def by_key(groups: list[PartGroup]) -> dict[str, PartGroup]:
    return {g.key: g for g in groups}


def test_stock_requested_group_and_warehouse_offers() -> None:
    groups = by_key(parse_search(load("search_stock"), "W683").groups)
    mann = groups["MANN|W683"]
    assert mann.is_requested
    assert mann.analog_of == []
    assert (mann.brand, mann.number, mann.number_norm) == ("MANN-FILTER", "w68/3", "W683")
    first = mann.offers[0]
    assert first.stock_id == "xmn-w68/3|95"
    assert first.warehouse == "Грозный"
    assert first.delivery_days == 0
    assert first.purchase_price == Decimal("574.75")
    assert first.kind == "normal"
    assert first.kind_code == "Aftermarket"
    assert first.order_code == "xmn-w68/3"
    assert first.multiplicity == 1


def test_brand_from_producer_brand() -> None:
    groups = by_key(parse_search(load("search_stock"), "W683").groups)
    toyota = groups["TOYOTA|90915YZZM3"]
    assert not toyota.is_requested
    assert toyota.analog_of == ["MANN|W683"]
    assert toyota.brand == "TOYOTA"
    assert "NORDFIL|ON1155" in groups


def test_ten_means_ten_plus() -> None:
    groups = by_key(parse_search(load("search_stock"), "W683").groups)
    nordfil = groups["NORDFIL|ON1155"].offers
    assert (nordfil[0].qty, nordfil[0].qty_plus) == (10, True)
    assert (nordfil[1].qty, nordfil[1].qty_plus) == (4, False)


def test_orders_kinds() -> None:
    groups = by_key(parse_search(load("search_orders"), "W683").groups)
    mann = groups["MANN|W683"]
    assert mann.is_requested
    normal = [o for o in mann.offers if o.kind == "normal"]
    assert normal and normal[0].stock_id == "xmn-w68/3|95"
    order = next(o for o in mann.offers if o.stock_id == "v1004-w683")
    assert order.kind == "order"
    assert order.delivery_days == 3
    assert order.warehouse == "Склад №1004"
    assert order.qty == 0
    assert order.order_code == "v1004-w683"
    assert len([o for o in mann.offers if o.kind == "order"]) == 3


def test_question_mark_rows_are_variants() -> None:
    groups = by_key(parse_search(load("search_orders"), "W683").groups)
    oem = groups["MAN|W683"]
    assert oem.is_requested
    (offer,) = oem.offers
    assert offer.kind == "variants"
    assert offer.qty == 0
    assert offer.delivery_days is None
    assert offer.warehouse == "Варианты поставки"
    assert offer.stock_id == "gmnw683"
    assert offer.kind_code == "OEM"
    analog = groups["DODA|1110020070"]
    assert not analog.is_requested
    assert analog.offers[0].kind == "variants"


def test_stock_info() -> None:
    offers = parse_stock_info(load("cbsi"))
    assert offers[0].stock_id == "xmn-w68/3|95"
    assert offers[0].purchase_price == Decimal("574.75")
    assert offers[0].multiplicity == 1
    assert offers[2].stock_id == "xmn-w68/3|23"
    assert all(o.stock_id == o.stock_id.lower() for o in offers)
    assert all(o.order_code == "xmn-w68/3" for o in offers)


def test_stock_info_auth_error() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_stock_info(load("cbsi_auth_error"))
    assert exc.value.message == "Микадо: ошибка авторизации"


def test_info_oem_variants() -> None:
    result = parse_info(load("info_oem"), "gto90915yzzm3")
    assert len(result.offers) >= 3
    first = result.offers[0]
    assert first.purchase_price == Decimal("504")
    assert (first.delivery_days, first.delivery_days_max, first.rating) == (0, 4, 100)
    assert first.kind == "normal"
    assert first.stock_id == "gto90915yzzm3#13"
    assert first.warehouse.startswith("С.-Петербург")
    assert first.qty == 5
    assert all(o.kind == "order" for o in result.offers[1:])
    assert result.offers[1].warehouse == "Под заказ"
    assert result.message is None


def test_info_order_message() -> None:
    result = parse_info(load("info_order"), "v1004-w683")
    (offer,) = result.offers
    assert offer.kind == "order"
    assert offer.stock_id == "v1004-w683"
    assert offer.delivery_days == 3
    assert offer.rating == 66
    assert result.message is not None and result.message.startswith("Внимание!")


def wrap(rows: str) -> bytes:
    return (
        '<Code_List xmlns="http://mikado-parts.ru/service"><List>' + rows + "</List></Code_List>"
    ).encode()


def row(price: str, qty: str, code_type: str = "Aftermarket", min_qty: str = "") -> str:
    return (
        "<Code_List_Row><ZakazCode>X-1</ZakazCode><ProducerBrand>B</ProducerBrand>"
        f"<ProducerCode>a1</ProducerCode><Name>n</Name><PriceRUR>{price}</PriceRUR>"
        f"<CodeType>{code_type}</CodeType><MinZakazQTY>{min_qty}</MinZakazQTY>"
        "<OnStocks><StockLine><StokName>S</StokName><StokID>1</StokID>"
        f"<StockQTY>{qty}</StockQTY><DeliveryDelay>1</DeliveryDelay></StockLine></OnStocks>"
        "</Code_List_Row>"
    )


def test_bad_price_row_skipped_and_not_defined_ignored() -> None:
    xml = wrap(
        row("0", "1") + row("abc", "1") + row("5", "1", "NotDefined") + row("5", "20+", min_qty="4")
    )
    (group,) = parse_search(xml, "A1").groups
    (offer,) = group.offers
    assert (offer.qty, offer.qty_plus, offer.multiplicity) == (20, True, 4)
    assert offer.stock_id == "x-1|1"


def test_not_xml_raises() -> None:
    with pytest.raises(SupplierError):
        parse_search(b"<html>", "A1")
