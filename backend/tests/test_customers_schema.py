import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

ITEM = (
    "INSERT INTO stock_items (number_norm, number_raw, brand, name, qty, "
    "purchase_price, markup, sale_price) "
    "VALUES ('W683', 'W683', 'MANN-FILTER', 'x', 5, 100, 30, 130) RETURNING id"
)


async def _customer(s: AsyncSession, name: str = "Иван Тест") -> int:
    return (
        await s.execute(text("INSERT INTO customers (name) VALUES (:n) RETURNING id"), {"n": name})
    ).scalar_one()


async def _car(s: AsyncSession, customer_id: int) -> int:
    return (
        await s.execute(
            text("INSERT INTO customer_cars (customer_id, make) VALUES (:c, 'Test') RETURNING id"),
            {"c": customer_id},
        )
    ).scalar_one()


async def _move(s: AsyncSession, type_: str, customer_id: int | None, car_id: int | None) -> int:
    item_id = (await s.execute(text(ITEM))).scalar_one()
    return (
        await s.execute(
            text(
                "INSERT INTO stock_moves (item_id, type, qty_delta, qty_after, customer_id, car_id)"
                " VALUES (:i, :t, -1, 4, :c, :car) RETURNING id"
            ),
            {"i": item_id, "t": type_, "c": customer_id, "car": car_id},
        )
    ).scalar_one()


async def test_blank_name_rejected(db_session: AsyncSession) -> None:
    with pytest.raises(IntegrityError):
        await _customer(db_session, "   ")


async def test_duplicate_phone_for_customer_rejected(db_session: AsyncSession) -> None:
    cid = await _customer(db_session)
    ins = text("INSERT INTO customer_phones (customer_id, phone) VALUES (:c, '79000000001')")
    await db_session.execute(ins, {"c": cid})
    with pytest.raises(IntegrityError):
        await db_session.execute(ins, {"c": cid})


async def test_writeoff_with_customer_rejected(db_session: AsyncSession) -> None:
    cid = await _customer(db_session)
    with pytest.raises(IntegrityError):
        await _move(db_session, "writeoff", cid, None)


async def test_sale_with_customer_and_car_ok(db_session: AsyncSession) -> None:
    cid = await _customer(db_session)
    await _move(db_session, "sale", cid, await _car(db_session, cid))


async def test_car_year_range(db_session: AsyncSession) -> None:
    cid = await _customer(db_session)
    with pytest.raises(IntegrityError):
        await db_session.execute(
            text("INSERT INTO customer_cars (customer_id, year) VALUES (:c, 1900)"), {"c": cid}
        )


async def test_delete_customer_cascades_and_nulls_moves(db_session: AsyncSession) -> None:
    cid = await _customer(db_session)
    car = await _car(db_session, cid)
    await db_session.execute(
        text("INSERT INTO customer_phones (customer_id, phone) VALUES (:c, '79000000001')"),
        {"c": cid},
    )
    move = await _move(db_session, "sale", cid, car)
    await db_session.execute(text("DELETE FROM customers WHERE id = :c"), {"c": cid})
    assert (
        await db_session.execute(text("SELECT count(*) FROM customer_phones"))
    ).scalar_one() == 0
    assert (await db_session.execute(text("SELECT count(*) FROM customer_cars"))).scalar_one() == 0
    row = (
        await db_session.execute(
            text("SELECT customer_id, car_id FROM stock_moves WHERE id = :m"), {"m": move}
        )
    ).one()
    assert tuple(row) == (None, None)
