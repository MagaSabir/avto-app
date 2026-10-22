import re
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from app.suppliers.base import OrderPart, SupplierError
from app.suppliers.rossko import BAD_RESPONSE, parse_orders

FIXTURES = Path(__file__).parent.parent / "fixtures"
OK = (FIXTURES / "rossko_orders.xml").read_bytes()
ERROR = (FIXTURES / "rossko_orders_error.xml").read_bytes()


def test_order_fields() -> None:
    order = parse_orders(OK)[0]
    assert order.id == 100000001
    assert order.created_at == datetime(2026, 10, 18, 11, 35, 45, tzinfo=UTC)
    assert order.delivery_date == date(2026, 10, 19)
    assert order.total == Decimal("1191")
    assert order.stock_address == "г. Тестовый, ул. Складская, 1"
    assert order.delivery_type == "Курьерская доставка"
    assert order.delivery_cost == Decimal("0")
    assert order.delivery_address == "село Тестовое, ул. Примерная"
    assert order.payment_type == "Оплата наличными при получении товара"
    assert order.comment == "Тестовый комментарий"
    assert len(order.parts) == 2


def test_part_fields() -> None:
    parts = parse_orders(OK)[0].parts
    assert parts[0] == OrderPart(
        "TEST0000000001", "PARTS-MALL", "HCZB-003", "Клапан впускной", Decimal("213.00"), 4, 1,
        "Позвонить", 2,
    )  # fmt: skip
    assert parts[1].comment is None
    assert parts[1].delivery_days == 0
    assert parts[1].status_code == 31


def test_pickup_without_address() -> None:
    order = parse_orders(OK)[1]
    assert order.id == 100000002
    assert order.delivery_address is None
    assert order.comment is None
    assert order.delivery_type == "Самовывоз"


def test_empty_list() -> None:
    text = OK.decode()
    empty = re.sub(r"<ns1:OrdersList>.*</ns1:OrdersList>", "<ns1:OrdersList/>", text, flags=re.S)
    assert empty != text
    assert parse_orders(empty.encode()) == []
    missing = re.sub(r"<ns1:OrdersList>.*</ns1:OrdersList>", "", text, flags=re.S)
    assert parse_orders(missing.encode()) == []


def test_empty_delivery_date() -> None:
    text = OK.decode().replace("<ns1:delivery_date>19.10.2026", "<ns1:delivery_date>", 1)
    text = text.replace("<ns1:delivery>1</ns1:delivery>", "<ns1:delivery></ns1:delivery>", 1)
    order = parse_orders(text.encode())[0]
    assert order.delivery_date is None
    assert order.parts[0].delivery_days is None


def test_error_raises_with_message() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_orders(ERROR)
    assert exc.value.message == "Неверные ключи авторизации"


@pytest.mark.parametrize(
    "old,new",
    [
        ("18.10.2026 14:35:45", "2026-10-18"),
        ("<ns1:price>213.00<", "<ns1:price>abc<"),
    ],
)
def test_bad_values_raise(old: str, new: str) -> None:
    xml = OK.decode().replace(old, new, 1).encode()
    with pytest.raises(SupplierError) as exc:
        parse_orders(xml)
    assert exc.value.message == BAD_RESPONSE


def test_broken_xml_raises() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_orders(b"<not-xml")
    assert exc.value.message == BAD_RESPONSE
