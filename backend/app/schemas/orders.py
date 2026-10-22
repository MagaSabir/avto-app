from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.types import Money


class OrderPartOut(BaseModel):
    guid: str
    brand: str
    number: str
    name: str
    price: Money
    count: int
    delivery_days: int | None
    comment: str | None
    status_code: int


class OrderOut(BaseModel):
    id: int
    created_at: datetime
    delivery_date: date | None
    total: Money
    stock_address: str
    delivery_type: str
    delivery_cost: Money | None
    delivery_address: str | None
    payment_type: str
    comment: str | None
    parts: list[OrderPartOut]


class OrdersData(BaseModel):
    orders: list[OrderOut]
    truncated: bool


class OrdersOut(BaseModel):
    code: str
    title: str
    status: Literal["ok", "error"]
    message: str | None
    data: OrdersData | None
