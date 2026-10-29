from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.stock import Payment
from app.schemas.customers import CustomerRef
from app.schemas.types import Money


class CashTotals(BaseModel):
    sales: Money
    returns: Money
    revenue: Money
    cash: Money
    transfer: Money
    profit: Money
    no_cost_count: int
    no_payment_count: int
    writeoffs: Money
    writeoffs_no_cost_count: int
    profit_after_writeoffs: Money


class CashOperation(BaseModel):
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
    cost: Money | None
    profit: Money | None
    user: str | None
    customer: CustomerRef | None = None


class CashOut(BaseModel):
    totals: CashTotals
    operations: list[CashOperation]
