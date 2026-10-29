from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.stock import Payment
from app.schemas.types import Money


class CarIn(BaseModel):
    make: str | None = None
    model: str | None = None
    engine: str | None = None
    vin: str | None = None
    plate: str | None = None
    year: int | None = None


class CarPatch(CarIn):
    model_config = ConfigDict(extra="forbid")


class CarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    make: str | None
    model: str | None
    engine: str | None
    vin: str | None
    plate: str | None
    year: int | None


class CustomerRef(BaseModel):
    id: int
    name: str


class CarBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    make: str | None
    model: str | None
    plate: str | None


class CustomerIn(BaseModel):
    name: str
    comment: str | None = None
    phones: list[str] = []


class CustomerPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    comment: str | None = None
    phones: list[str] | None = None


class CustomerOut(BaseModel):
    id: int
    name: str
    comment: str | None
    phones: list[str]
    cars: list[CarOut]
    created_at: datetime


class CustomerSaved(CustomerOut):
    warnings: list[str]


class CustomerBrief(BaseModel):
    id: int
    name: str
    phones: list[str]
    cars: list[CarBrief]


class CustomerHistoryRow(BaseModel):
    move_id: int
    type: Literal["sale", "return"]
    created_at: datetime
    item_id: int
    number_raw: str
    brand: str
    name: str
    qty: int
    price: Money
    amount: Money
    payment: Payment | None
    car: CarBrief | None
