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


async def test_item_markup_may_be_negative_above_minus_100(db_session: AsyncSession) -> None:
    await db_session.execute(
        text(ITEM.replace("100, 30, 130", "100, -99.99, 0.01")), {"n": "N1", "b": "B", "q": 0}
    )


async def test_item_markup_minus_100_rejected(db_session: AsyncSession) -> None:
    with pytest.raises(IntegrityError, match="markup_above_minus_100"):
        await db_session.execute(
            text(ITEM.replace("100, 30, 130", "100, -100, 130")), {"n": "N2", "b": "B", "q": 0}
        )


async def _move_ext(s: AsyncSession, item_id: int, type_: str, **extra: object) -> None:
    cols = ["item_id", "type", "qty_delta", "qty_after", *extra]
    vals = [":item_id", ":type", "1", "1", *(f":{k}" for k in extra)]
    await s.execute(
        text(f"INSERT INTO stock_moves ({', '.join(cols)}) VALUES ({', '.join(vals)})"),
        {"item_id": item_id, "type": type_, **extra},
    )


async def test_move_payment_checked(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    with pytest.raises(IntegrityError, match="payment_valid"):
        await _move_ext(db_session, item_id, "sale", payment="card")


async def test_cancel_requires_link(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    with pytest.raises(IntegrityError, match="cancel_link"):
        await _move_ext(db_session, item_id, "cancel")


async def test_link_requires_cancel_type(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    await _move_ext(db_session, item_id, "sale")
    sale_id = (await db_session.execute(text("SELECT max(id) FROM stock_moves"))).scalar_one()
    with pytest.raises(IntegrityError, match="cancel_link"):
        await _move_ext(db_session, item_id, "sale", cancels_move_id=sale_id)


async def test_move_type_cancel_allowed(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    await _move_ext(db_session, item_id, "sale", payment="cash")
    sale_id = (await db_session.execute(text("SELECT max(id) FROM stock_moves"))).scalar_one()
    await _move_ext(db_session, item_id, "cancel", cancels_move_id=sale_id)


async def test_move_cancelled_only_once(db_session: AsyncSession) -> None:
    item_id = await _item(db_session)
    await _move_ext(db_session, item_id, "sale")
    sale_id = (await db_session.execute(text("SELECT max(id) FROM stock_moves"))).scalar_one()
    await _move_ext(db_session, item_id, "cancel", cancels_move_id=sale_id)
    with pytest.raises(IntegrityError):
        await _move_ext(db_session, item_id, "cancel", cancels_move_id=sale_id)
