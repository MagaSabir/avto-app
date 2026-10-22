from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Protocol, runtime_checkable

OfferKind = Literal["normal", "sale", "defect", "air", "other"]


@dataclass(frozen=True)
class Offer:
    warehouse: str
    qty: int
    multiplicity: int
    delivery_days: int | None
    delivery_from: datetime | None
    delivery_to: datetime | None
    kind: OfferKind
    kind_code: str
    purchase_price: Decimal


@dataclass
class PartGroup:
    brand: str
    number: str
    number_norm: str
    name: str
    is_requested: bool
    offers: list[Offer]
    key: str
    analog_of: list[str]


@dataclass(frozen=True)
class SupplierResult:
    groups: list[PartGroup]
    message: str | None


class SupplierError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class Supplier(Protocol):
    code: str
    title: str

    async def search(self, number: str) -> SupplierResult: ...


@dataclass(frozen=True)
class SettlementCustomer:
    id: str
    name: str
    balance: Decimal


@dataclass(frozen=True)
class SettlementPayment:
    date: date
    amount: Decimal
    contractor: str
    contractor_debt: Decimal


@dataclass(frozen=True)
class SettlementItem:
    name: str
    count: int
    price: Decimal


@dataclass(frozen=True)
class SettlementDocument:
    date: datetime
    name: str
    amount: Decimal
    balance: Decimal
    payer: str
    status: str
    order_id: int | None
    days_remaining: int | None
    items: list[SettlementItem]


@dataclass(frozen=True)
class Settlements:
    balance: Decimal
    limit: Decimal | None
    kind: str
    payment_delay: int | None
    currency: str
    customers: list[SettlementCustomer]
    overdue_days: int | None
    overdue_sum: Decimal | None
    payments: list[SettlementPayment]
    documents_total: int
    page_size: int
    page: int
    documents: list[SettlementDocument]


@runtime_checkable
class SettlementsSupplier(Supplier, Protocol):
    async def settlements(
        self,
        page: int,
        status: str | None = None,
        start: date | None = None,
        end: date | None = None,
    ) -> Settlements: ...
