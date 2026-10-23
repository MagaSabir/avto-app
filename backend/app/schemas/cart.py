from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.types import Money
from app.suppliers.base import OfferKind


class CartItemIn(BaseModel):
    supplier: str
    stock_id: str = Field(min_length=1)
    brand: str
    number: str
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
    kind: str
    kind_code: str
    price: Money
    sum: Money


class CartOut(BaseModel):
    items: list[CartItemOut]
    total: Money


class CartQtyIn(BaseModel):
    qty: int
