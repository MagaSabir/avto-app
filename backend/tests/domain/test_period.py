from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.domain.period import MAX_PERIOD_DAYS, period_bounds

MSK = ZoneInfo("Europe/Moscow")


def test_one_day_in_moscow() -> None:
    assert period_bounds(date(2026, 10, 29), date(2026, 10, 29), MSK) == (
        datetime(2026, 10, 28, 21, 0, tzinfo=UTC),
        datetime(2026, 10, 29, 21, 0, tzinfo=UTC),
    )


def test_period_across_month_end() -> None:
    assert period_bounds(date(2026, 9, 30), date(2026, 10, 1), MSK) == (
        datetime(2026, 9, 29, 21, 0, tzinfo=UTC),
        datetime(2026, 10, 1, 21, 0, tzinfo=UTC),
    )


def test_end_before_start() -> None:
    assert period_bounds(date(2026, 10, 29), date(2026, 10, 28), MSK) is None


def test_max_period_allowed() -> None:
    start = date(2025, 10, 29)
    end = start + timedelta(days=MAX_PERIOD_DAYS - 1)
    assert MAX_PERIOD_DAYS == 366
    assert period_bounds(start, end, MSK) is not None


def test_longer_period_rejected() -> None:
    start = date(2025, 10, 29)
    assert period_bounds(start, start + timedelta(days=MAX_PERIOD_DAYS), MSK) is None
