from decimal import Decimal

import pytest

from app.domain.pricing import markup_from_sale, sale_price


@pytest.mark.parametrize(
    ("purchase", "markup", "expected"),
    [
        ("412.00", "30", "540.00"),
        ("415.38", "30", "540.00"),
        ("400", "35", "540.00"),
        ("415.39", "30", "550.00"),
        ("100", "0", "100.00"),
        ("101", "0", "110.00"),
        ("100", "33.33", "140.00"),
        ("0.01", "0", "10.00"),
    ],
)
def test_sale_price(purchase: str, markup: str, expected: str) -> None:
    result = sale_price(Decimal(purchase), Decimal(markup))
    assert result == Decimal(expected)
    assert str(result) == expected


@pytest.mark.parametrize(
    ("purchase", "sale", "expected"),
    [("412", "540", "31.07"), ("400", "540", "35.00"), ("500", "400", "-20.00")],
)
def test_markup_from_sale(purchase: str, sale: str, expected: str) -> None:
    result = markup_from_sale(Decimal(purchase), Decimal(sale))
    assert str(result) == expected
