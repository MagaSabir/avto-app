from datetime import datetime

from pydantic import BaseModel

from app.schemas.stock import StockItemOut


class StockSearchItem(StockItemOut):
    last_receipt_at: datetime | None
    last_receipt_supplier: str | None
    sold_30d: int


class StockSearchResult(BaseModel):
    query: str
    number_norm: str
    items: list[StockSearchItem]
