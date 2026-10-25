from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "supplier", "number_norm", "brand", "stock_id", name="uq_cart_items_offer"
        ),
        CheckConstraint("qty > 0", name="qty_positive"),
        CheckConstraint("multiplicity > 0", name="multiplicity_positive"),
        CheckConstraint("available >= 0", name="available_non_negative"),
        CheckConstraint("price > 0", name="price_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    supplier: Mapped[str] = mapped_column(Text)
    stock_id: Mapped[str] = mapped_column(Text)
    brand: Mapped[str] = mapped_column(Text)
    number_raw: Mapped[str] = mapped_column(Text)
    number_norm: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    warehouse: Mapped[str] = mapped_column(Text)
    multiplicity: Mapped[int] = mapped_column(Integer)
    qty: Mapped[int] = mapped_column(Integer)
    available: Mapped[int] = mapped_column(Integer)
    delivery_days: Mapped[int | None] = mapped_column(Integer)
    delivery_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(Text)
    kind_code: Mapped[str] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
