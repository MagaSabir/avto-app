from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.stock import StockItemOut
from app.schemas.types import Money, Percent
from app.suppliers.base import OfferKind


class StockSearchItem(StockItemOut):
    last_receipt_at: datetime | None
    last_receipt_supplier: str | None
    sold_30d: int


class StockSearchResult(BaseModel):
    query: str
    number_norm: str
    items: list[StockSearchItem]


class SupplierInfo(BaseModel):
    code: str
    title: str


class OfferOut(BaseModel):
    warehouse: str
    stock_id: str
    qty: int
    multiplicity: int
    delivery_days: int | None
    delivery_from: datetime | None
    delivery_to: datetime | None
    kind: OfferKind
    kind_code: str
    purchase_price: Money
    price: Money
    qty_plus: bool = False
    delivery_days_max: int | None = None
    rating: int | None = None
    order_code: str | None = None


class PartGroupOut(BaseModel):
    brand: str
    number: str
    number_norm: str
    name: str
    is_requested: bool
    key: str
    analog_of: list[str]
    offers: list[OfferOut]


class SupplierSearchResult(BaseModel):
    code: str
    title: str
    status: Literal["ok", "error"]
    message: str | None
    markup: Percent
    groups: list[PartGroupOut]
    stock_matches: list[StockSearchItem]


class SupplierVariantsOut(BaseModel):
    code: str
    title: str
    status: Literal["ok", "error"]
    message: str | None
    markup: Percent
    offers: list[OfferOut]
