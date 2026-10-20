"""allow negative markup

Revision ID: a1b2c3d4e5f6
Revises: c6e2c7231cfe
Create Date: 2026-10-20 23:30:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "c6e2c7231cfe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_stock_items_markup_non_negative"), "stock_items", type_="check")
    op.create_check_constraint(
        op.f("ck_stock_items_markup_above_minus_100"), "stock_items", "markup > -100"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_stock_items_markup_above_minus_100"), "stock_items", type_="check")
    op.create_check_constraint(
        op.f("ck_stock_items_markup_non_negative"), "stock_items", "markup >= 0"
    )
