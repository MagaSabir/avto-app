from datetime import UTC, datetime, timedelta

import pytest

from app.domain.stock import CancelBlock, StockStatus, cancel_block, stock_status


@pytest.mark.parametrize(
    ("qty", "min_qty", "expected"),
    [(0, 1, "out"), (1, 1, "low"), (2, 1, "ok"), (0, 0, "out"), (1, 0, "ok"), (3, 3, "low")],
)
def test_stock_status(qty: int, min_qty: int, expected: StockStatus) -> None:
    assert stock_status(qty, min_qty) == expected


NOW = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("move_type", "age", "is_last", "cancelled", "expected"),
    [
        ("sale", timedelta(minutes=5), True, False, None),
        ("cancel", timedelta(minutes=5), True, False, "is_cancel"),
        ("sale", timedelta(minutes=5), False, True, "already_cancelled"),
        ("sale", timedelta(minutes=5), False, False, "not_last"),
        ("sale", timedelta(hours=24), True, False, None),
        ("sale", timedelta(hours=24, seconds=1), True, False, "too_old"),
        ("cancel", timedelta(hours=48), True, False, "is_cancel"),
    ],
)
def test_cancel_block(
    move_type: str,
    age: timedelta,
    is_last: bool,
    cancelled: bool,
    expected: CancelBlock | None,
) -> None:
    result = cancel_block(
        move_type=move_type,
        created_at=NOW - age,
        now=NOW,
        is_last=is_last,
        cancelled=cancelled,
    )
    assert result == expected
