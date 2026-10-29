from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

MoveType = Literal["receipt", "sale", "return", "writeoff", "adjustment", "cancel"]
Payment = Literal["cash", "transfer"]


class StockItem(Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        UniqueConstraint("number_norm", "brand"),
        CheckConstraint("qty >= 0", name="qty_non_negative"),
        CheckConstraint("min_qty >= 0", name="min_qty_non_negative"),
        CheckConstraint("purchase_price > 0", name="purchase_price_positive"),
        CheckConstraint("markup > -100", name="markup_above_minus_100"),
        CheckConstraint("sale_price > 0", name="sale_price_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    number_norm: Mapped[str] = mapped_column(Text, index=True)
    number_raw: Mapped[str] = mapped_column(Text)
    brand: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    qty: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    min_qty: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    cell: Mapped[str | None] = mapped_column(Text)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    markup: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StockMove(Base):
    __tablename__ = "stock_moves"
    __table_args__ = (
        CheckConstraint(
            "type IN ('receipt', 'sale', 'return', 'writeoff', 'adjustment', 'cancel')",
            name="type_valid",
        ),
        CheckConstraint("payment IS NULL OR payment IN ('cash', 'transfer')", name="payment_valid"),
        CheckConstraint("(type = 'cancel') = (cancels_move_id IS NOT NULL)", name="cancel_link"),
        CheckConstraint("qty_delta <> 0", name="qty_delta_non_zero"),
        CheckConstraint("qty_after >= 0", name="qty_after_non_negative"),
        Index("ix_stock_moves_item_id_created_at", "item_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("stock_items.id"))
    type: Mapped[MoveType] = mapped_column(String)
    qty_delta: Mapped[int] = mapped_column(Integer)
    qty_after: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    supplier: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    payment: Mapped[Payment | None] = mapped_column(String)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    cancels_move_id: Mapped[int | None] = mapped_column(ForeignKey("stock_moves.id"), unique=True)
    prev_purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    prev_sale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    prev_markup: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
