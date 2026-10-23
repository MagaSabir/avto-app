"""cart

Revision ID: f535edbe7add
Revises: fa7f7b5a96da
Create Date: 2026-10-23 14:38:54.291927

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f535edbe7add"
down_revision: str | Sequence[str] | None = "fa7f7b5a96da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("supplier", sa.Text(), nullable=False),
        sa.Column("stock_id", sa.Text(), nullable=False),
        sa.Column("brand", sa.Text(), nullable=False),
        sa.Column("number_raw", sa.Text(), nullable=False),
        sa.Column("number_norm", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("warehouse", sa.Text(), nullable=False),
        sa.Column("multiplicity", sa.Integer(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False),
        sa.Column("delivery_days", sa.Integer(), nullable=True),
        sa.Column("delivery_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("kind_code", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("available >= 0", name=op.f("ck_cart_items_available_non_negative")),
        sa.CheckConstraint("multiplicity > 0", name=op.f("ck_cart_items_multiplicity_positive")),
        sa.CheckConstraint("price > 0", name=op.f("ck_cart_items_price_positive")),
        sa.CheckConstraint("qty > 0", name=op.f("ck_cart_items_qty_positive")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_cart_items_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cart_items")),
        sa.UniqueConstraint(
            "user_id",
            "supplier",
            "number_norm",
            "brand",
            "stock_id",
            name=op.f("uq_cart_items_offer"),
        ),
    )
    op.create_index(op.f("ix_cart_items_user_id"), "cart_items", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_cart_items_user_id"), table_name="cart_items")
    op.drop_table("cart_items")
