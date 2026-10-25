import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import users

CART = (
    "INSERT INTO cart_items (user_id, supplier, stock_id, brand, number_raw, number_norm, "
    "name, warehouse, multiplicity, qty, available, kind, kind_code, price) "
    "VALUES (:u, 'rossko', 's1', 'MANN-FILTER', 'W 683', 'W683', 'x', 'Msk', 1, :q, 5, "
    "'stock', 'main', :p)"
)


async def _cart(s: AsyncSession, user_id: int, q: int = 1, p: int = 100) -> None:
    await s.execute(text(CART), {"u": user_id, "q": q, "p": p})


async def _user(s: AsyncSession, login: str = "u1") -> int:
    return (await users.add(s, login, "hash")).id


async def test_cart_duplicate_key_rejected(db_session: AsyncSession) -> None:
    uid = await _user(db_session)
    await _cart(db_session, uid)
    with pytest.raises(IntegrityError):
        await _cart(db_session, uid)


async def test_cart_same_key_for_other_user_allowed(db_session: AsyncSession) -> None:
    await _cart(db_session, await _user(db_session, "u1"))
    await _cart(db_session, await _user(db_session, "u2"))


async def test_cart_qty_must_be_positive(db_session: AsyncSession) -> None:
    uid = await _user(db_session)
    with pytest.raises(IntegrityError, match="qty_positive"):
        await _cart(db_session, uid, q=0)


async def test_cart_price_must_be_positive(db_session: AsyncSession) -> None:
    uid = await _user(db_session)
    with pytest.raises(IntegrityError, match="price_positive"):
        await _cart(db_session, uid, p=0)


async def test_deleting_user_deletes_cart_rows(db_session: AsyncSession) -> None:
    uid = await _user(db_session)
    await _cart(db_session, uid)
    await db_session.execute(text("DELETE FROM users WHERE id = :u"), {"u": uid})
    count = (await db_session.execute(text("SELECT count(*) FROM cart_items"))).scalar_one()
    assert count == 0
