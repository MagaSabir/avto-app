from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

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


class SaleIn(BaseModel):
    qty: int = Field(gt=0)
    price: Decimal = Field(gt=0, decimal_places=2)
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class ReturnIn(SaleIn):
    pass


class WriteoffIn(BaseModel):
    qty: int = Field(gt=0)
    comment: str = Field(min_length=1)

    @field_validator("comment", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AdjustmentIn(BaseModel):
    actual_qty: int = Field(ge=0)
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class StatusCounts(BaseModel):
    all: int
    low: int
    out: int


class StockItemList(BaseModel):
    items: list[StockItemOut]
    counts: StatusCounts


class StockItemDetail(StockItemOut):
    last_receipt_at: datetime | None
    last_receipt_supplier: str | None
    last_sale_at: datetime | None
    sold_30d: int


class StockItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    cell: str | None = None
    min_qty: int | None = Field(default=None, ge=0)
    purchase_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    markup: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    sale_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

    @field_validator("cell")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _no_null_required(self) -> "StockItemPatch":
        for field in ("name", "min_qty", "purchase_price", "markup", "sale_price"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self
