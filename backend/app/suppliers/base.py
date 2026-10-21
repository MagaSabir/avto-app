from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal, Protocol

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
