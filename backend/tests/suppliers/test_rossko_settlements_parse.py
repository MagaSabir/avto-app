import re
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from app.suppliers.base import (
    SettlementCustomer,
    SettlementItem,
    SettlementPayment,
    SupplierError,
)
from app.suppliers.rossko import BAD_RESPONSE, parse_settlements

FIXTURES = Path(__file__).parent.parent / "fixtures"
OK = (FIXTURES / "rossko_settlements.xml").read_bytes()
ERROR = (FIXTURES / "rossko_settlements_error.xml").read_bytes()


def test_info_fields() -> None:
    s = parse_settlements(OK)
    assert s.balance == Decimal("-1250.40")
    assert s.limit == Decimal("50000")
    assert s.kind == "Лимит кредит"
    assert s.payment_delay == 14
    assert s.currency == "руб"
    assert s.customers == [
        SettlementCustomer(
            id="00000000-0000-0000-0000-000000000001",
            name="ИП Тестов",
            balance=Decimal("-1250.40"),
        )
    ]


def test_summary_fields() -> None:
    s = parse_settlements(OK)
    assert s.overdue_days == 3
    assert s.overdue_sum == Decimal("500.00")
    assert s.payments == [
        SettlementPayment(
            date=date(2026, 10, 25),
            amount=Decimal("750.40"),
            contractor="ИП Тестов",
            contractor_debt=Decimal("750.40"),
        )
    ]


def test_empty_summary() -> None:
    xml = re.sub(rb"<ns1:Summary>.*</ns1:Summary>", b"<ns1:Summary/>", OK)
    s = parse_settlements(xml)
    assert s.overdue_days is None
    assert s.overdue_sum is None
    assert s.payments == []


def test_documents_paging() -> None:
    s = parse_settlements(OK)
    assert s.documents_total == 41
    assert s.page_size == 20
    assert s.page == 0
    assert len(s.documents) == 3


def test_payment_document() -> None:
    doc = parse_settlements(OK).documents[0]
    assert doc.amount == Decimal("0.00")
    assert doc.balance == Decimal("-1250.40")
    assert doc.order_id is None
    assert doc.days_remaining is None
    assert doc.items == []
    assert doc.date == datetime(2026, 10, 20, 9, 15, 28, tzinfo=UTC)
    assert doc.name == "Оплата картой ТЕСТ0001"
    assert doc.status == "Проведено"
    assert doc.payer == "ИП Тестов"


def test_sale_document_items() -> None:
    doc = parse_settlements(OK).documents[1]
    assert doc.order_id == 100000001
    assert doc.days_remaining == 11
    assert doc.items == [
        SettlementItem(name="W 68/3 Фильтр масляный MANN-FILTER", count=2, price=Decimal("412.00")),
        SettlementItem(name="OC 90 Фильтр масляный KNECHT", count=1, price=Decimal("367.00")),
    ]


def test_error_raises_with_message() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_settlements(ERROR)
    assert exc.value.message == "Неверные ключи авторизации"


def test_bad_number_raises() -> None:
    xml = OK.replace(b"<ns1:balance>-1250.40</ns1:balance>", b"<ns1:balance>abc</ns1:balance>", 1)
    with pytest.raises(SupplierError) as exc:
        parse_settlements(xml)
    assert exc.value.message == BAD_RESPONSE


def test_broken_xml_raises() -> None:
    with pytest.raises(SupplierError) as exc:
        parse_settlements(b"<not xml")
    assert exc.value.message == BAD_RESPONSE


def test_page_from_document_offset() -> None:
    xml = OK.replace(b"<ns1:offset>0</ns1:offset>", b"<ns1:offset>40</ns1:offset>")
    assert parse_settlements(xml).page == 2
