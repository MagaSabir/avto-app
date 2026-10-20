from typing import Literal

StockStatus = Literal["ok", "low", "out"]


def stock_status(qty: int, min_qty: int) -> StockStatus:
    if qty <= 0:
        return "out"
    if qty <= min_qty:
        return "low"
    return "ok"
