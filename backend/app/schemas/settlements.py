from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.types import Money


class SettlementCustomerOut(BaseModel):
    id: str
    name: str
    balance: Money


class SettlementPaymentOut(BaseModel):
    date: date
    amount: Money
    contractor: str
    contractor_debt: Money


class SettlementItemOut(BaseModel):
    name: str
    count: int
    price: Money


class SettlementDocumentOut(BaseModel):
    date: datetime
    name: str
    amount: Money
    balance: Money
    payer: str
    status: str
    order_id: int | None
    days_remaining: int | None
    items: list[SettlementItemOut]


class SettlementsData(BaseModel):
    balance: Money
    limit: Money | None
    kind: str
    payment_delay: int | None
    currency: str
    customers: list[SettlementCustomerOut]
    overdue_days: int | None
    overdue_sum: Money | None
    payments: list[SettlementPaymentOut]
    documents_total: int
    page_size: int
    page: int
    documents: list[SettlementDocumentOut]


class SettlementsOut(BaseModel):
    code: str
    title: str
    status: Literal["ok", "error"]
    message: str | None
    data: SettlementsData | None
