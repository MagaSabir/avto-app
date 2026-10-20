from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.domain.numbers import normalize_brand, normalize_number
from app.domain.stock import StockStatus, stock_status
from app.models.stock import MoveType
from app.schemas.types import Money, Percent


class StockItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number_raw: str
    number_norm: str
    brand: str
    name: str
    qty: int
    min_qty: int
    cell: str | None
    purchase_price: Money
    markup: Percent
    sale_price: Money

    @computed_field  # type: ignore[prop-decorator]
    @property
    def status(self) -> StockStatus:
        return stock_status(self.qty, self.min_qty)


class StockMoveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: MoveType
    qty_delta: int
    qty_after: int
    price: Money | None
    supplier: str | None
    comment: str | None
    created_at: datetime


class OperationResult(BaseModel):
    item: StockItemOut
    move: StockMoveOut


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class ReceiptIn(BaseModel):
    number: str = Field(min_length=1)
    brand: str = Field(min_length=1)
    name: str = Field(min_length=1)
    qty: int = Field(gt=0)
    cell: str | None = None
    purchase_price: Decimal = Field(gt=0, decimal_places=2)
    markup: Decimal = Field(ge=0, decimal_places=2)
    sale_price: Decimal = Field(gt=0, decimal_places=2)
    supplier: str | None = None
    comment: str | None = None
    price_policy: Literal["update", "keep"] = "update"

    @field_validator("number")
    @classmethod
    def _number_not_empty(cls, value: str) -> str:
        if not normalize_number(value):
            raise ValueError("number is empty after normalization")
        return value

    @field_validator("brand")
    @classmethod
    def _brand_not_empty(cls, value: str) -> str:
        if not normalize_brand(value):
            raise ValueError("brand is empty after normalization")
        return value

    @field_validator("cell", "supplier", "comment")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)
