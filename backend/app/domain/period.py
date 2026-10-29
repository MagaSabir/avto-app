from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

MAX_PERIOD_DAYS = 366


def period_bounds(start: date, end: date, tz: ZoneInfo) -> tuple[datetime, datetime] | None:
    """UTC half-open interval covering shop days start..end inclusive, or None if invalid."""
    if end < start or (end - start).days + 1 > MAX_PERIOD_DAYS:
        return None
    lower = datetime.combine(start, time.min, tzinfo=tz)
    upper = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    return lower.astimezone(UTC), upper.astimezone(UTC)
