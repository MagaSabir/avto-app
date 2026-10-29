"""sale plus

Revision ID: 0297c522375d
Revises: 7113baddc844
Create Date: 2026-10-29 21:19:26.414924

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0297c522375d"
down_revision: str | Sequence[str] | None = "7113baddc844"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "stock_moves", sa.Column("cost", sa.Numeric(precision=12, scale=2), nullable=True)
    )
    op.add_column("stock_moves", sa.Column("payment", sa.String(), nullable=True))
    op.add_column("stock_moves", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("stock_moves", sa.Column("cancels_move_id", sa.Integer(), nullable=True))
    op.add_column(
        "stock_moves",
        sa.Column("prev_purchase_price", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "stock_moves",
        sa.Column("prev_sale_price", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "stock_moves", sa.Column("prev_markup", sa.Numeric(precision=6, scale=2), nullable=True)
    )
    op.create_unique_constraint(
        op.f("uq_stock_moves_cancels_move_id"), "stock_moves", ["cancels_move_id"]
    )
    op.create_foreign_key(
        op.f("fk_stock_moves_cancels_move_id_stock_moves"),
        "stock_moves",
        "stock_moves",
        ["cancels_move_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_stock_moves_user_id_users"),
        "stock_moves",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint(op.f("ck_stock_moves_type_valid"), "stock_moves", type_="check")
    op.create_check_constraint(
        op.f("ck_stock_moves_type_valid"),
        "stock_moves",
        "type IN ('receipt', 'sale', 'return', 'writeoff', 'adjustment', 'cancel')",
    )
    op.create_check_constraint(
        op.f("ck_stock_moves_payment_valid"),
        "stock_moves",
        "payment IS NULL OR payment IN ('cash', 'transfer')",
    )
    op.create_check_constraint(
        op.f("ck_stock_moves_cancel_link"),
        "stock_moves",
        "(type = 'cancel') = (cancels_move_id IS NOT NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_stock_moves_cancel_link"), "stock_moves", type_="check")
    op.drop_constraint(op.f("ck_stock_moves_payment_valid"), "stock_moves", type_="check")
    op.drop_constraint(op.f("ck_stock_moves_type_valid"), "stock_moves", type_="check")
    op.create_check_constraint(
        op.f("ck_stock_moves_type_valid"),
        "stock_moves",
        "type IN ('receipt', 'sale', 'return', 'writeoff', 'adjustment')",
    )
    op.drop_constraint(op.f("fk_stock_moves_user_id_users"), "stock_moves", type_="foreignkey")
    op.drop_constraint(
        op.f("fk_stock_moves_cancels_move_id_stock_moves"), "stock_moves", type_="foreignkey"
    )
    op.drop_constraint(op.f("uq_stock_moves_cancels_move_id"), "stock_moves", type_="unique")
    op.drop_column("stock_moves", "prev_markup")
    op.drop_column("stock_moves", "prev_sale_price")
    op.drop_column("stock_moves", "prev_purchase_price")
    op.drop_column("stock_moves", "cancels_move_id")
    op.drop_column("stock_moves", "user_id")
    op.drop_column("stock_moves", "payment")
    op.drop_column("stock_moves", "cost")
