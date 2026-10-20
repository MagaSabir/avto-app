import pytest

from app.domain.stock import StockStatus, stock_status


@pytest.mark.parametrize(
    ("qty", "min_qty", "expected"),
    [(0, 1, "out"), (1, 1, "low"), (2, 1, "ok"), (0, 0, "out"), (1, 0, "ok"), (3, 3, "low")],
)
def test_stock_status(qty: int, min_qty: int, expected: StockStatus) -> None:
    assert stock_status(qty, min_qty) == expected
