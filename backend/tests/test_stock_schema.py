from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

ITEM = (
    "INSERT INTO stock_items (number_norm, number_raw, brand, name, qty, "
    "purchase_price, markup, sale_price) "
    "VALUES (:n, :n, :b, 'x', :q, 100, 30, 130) RETURNING id"
)


async def _item(s: AsyncSession, n: str = "W683", b: str = "MANN-FILTER", q: int = 0) -> int:
    return (await s.execute(text(ITEM), {"n": n, "b": b, "q": q})).scalar_one()


async def test_settings_row_seeded(db_session: AsyncSession) -> None:
    rows = (await db_session.execute(text("SELECT default_markup FROM settings"))).all()
    assert len(rows) == 1
    assert rows[0][0] == Decimal("30.00")


async def test_item_qty_cannot_be_negative(db_session: AsyncSession) -> None:
    with pytest.raises(IntegrityError):
        await _item(db_session, q=-1)


async def test_item_number_brand_unique(db_session: AsyncSession) -> None:
    await _item(db_session)
    with pytest.raises(IntegrityError):
        await _item(db_session)


async def _move(s: AsyncSession, item_id: int, type_: str, delta: int) -> None:
    await s.execute(
        text(
            "INSERT INTO stock_moves (item_id, type, qty_delta, qty_after) VALUES (:i, :t, :d, 1)"
        ),
        {"i": item_id, "t": type_, "d": delta},
    )


async def test_move_delta_cannot_be_zero(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    with pytest.raises(IntegrityError):
        await _move(db_session, item_id, "receipt", 0)


async def test_move_type_checked(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    with pytest.raises(IntegrityError):
        await _move(db_session, item_id, "gift", 1)
