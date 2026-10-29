from datetime import datetime, timedelta
from typing import Literal

StockStatus = Literal["ok", "low", "out"]
CancelBlock = Literal["is_cancel", "already_cancelled", "not_last", "too_old"]

CANCEL_WINDOW = timedelta(hours=24)


def stock_status(qty: int, min_qty: int) -> StockStatus:
    if qty <= 0:
        return "out"
    if qty <= min_qty:
        return "low"
    return "ok"


def cancel_block(
    *,
    move_type: str,
    created_at: datetime,
    now: datetime,
    is_last: bool,
    cancelled: bool,
) -> CancelBlock | None:
    """Return why a stock move cannot be cancelled, or None if it can."""
    if move_type == "cancel":
        return "is_cancel"
    if cancelled:
        return "already_cancelled"
    if not is_last:
        return "not_last"
    if now - created_at > CANCEL_WINDOW:
        return "too_old"
    return None
