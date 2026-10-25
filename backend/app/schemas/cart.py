from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.types import Money
from app.suppliers.base import OfferKind


class CartItemIn(BaseModel):
    supplier: str
    stock_id: str = Field(min_length=1)
    brand: str = Field(min_length=1)
    number: str = Field(min_length=1)
    name: str
    warehouse: str
    multiplicity: int = Field(gt=0)
    available: int = Field(ge=0)
    delivery_days: int | None
    delivery_from: AwareDatetime | None
    delivery_to: AwareDatetime | None
    kind: OfferKind
    kind_code: str
    price: Money = Field(gt=0)
    qty: int


class CartItemOut(BaseModel):
    id: int
    supplier: str
    stock_id: str
    brand: str
    number: str
    number_norm: str
    name: str
    warehouse: str
    multiplicity: int
    qty: int
    available: int
    delivery_days: int | None
    delivery_from: AwareDatetime | None
    delivery_to: AwareDatetime | None
    kind: OfferKind
    kind_code: str
    price: Money
    sum: Money


class CartOut(BaseModel):
    items: list[CartItemOut]
    total: Money


class CartQtyIn(BaseModel):
    qty: int


class CartRefreshItem(BaseModel):
    id: int
    state: Literal["ok", "gone", "unknown"]
    price: Money
    previous_price: Money | None
    available: int


class CartRefreshOut(BaseModel):
    status: Literal["ok", "error"]
    message: str | None
    items: list[CartRefreshItem]
