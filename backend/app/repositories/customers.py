from datetime import datetime

from sqlalchemy import ColumnElement, delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.customers import normalize_plate
from app.models.customers import Customer, CustomerCar, CustomerPhone
from app.models.stock import StockItem, StockMove

SEARCH_LIMIT = 50
MIN_PHONE_DIGITS = 3


async def get(session: AsyncSession, customer_id: int) -> Customer | None:
    return await session.get(Customer, customer_id)


async def add(session: AsyncSession, name: str, comment: str | None) -> Customer:
    customer = Customer(name=name, comment=comment)
    session.add(customer)
    await session.flush()
    return customer


async def touch(session: AsyncSession, customer: Customer) -> None:
    customer.updated_at = func.now()
    await session.flush()
    await session.refresh(customer)


async def delete_customer(session: AsyncSession, customer: Customer) -> None:
    await session.delete(customer)
    await session.flush()


async def replace_phones(session: AsyncSession, customer_id: int, phones: list[str]) -> None:
    await session.execute(delete(CustomerPhone).where(CustomerPhone.customer_id == customer_id))
    session.add_all(CustomerPhone(customer_id=customer_id, phone=p) for p in phones)
    await session.flush()


async def phone_owners(
    session: AsyncSession, phones: list[str], exclude_customer_id: int
) -> list[tuple[str, str]]:
    """(phone, customer name) for phones that other customers already have."""
    if not phones:
        return []
    result = await session.execute(
        select(CustomerPhone.phone, Customer.name)
        .join(Customer, Customer.id == CustomerPhone.customer_id)
        .where(CustomerPhone.phone.in_(phones), Customer.id != exclude_customer_id)
        .order_by(CustomerPhone.id)
    )
    return [(phone, name) for phone, name in result]


async def phones_by_customer(
    session: AsyncSession, customer_ids: list[int]
) -> dict[int, list[str]]:
    result = await session.execute(
        select(CustomerPhone.customer_id, CustomerPhone.phone)
        .where(CustomerPhone.customer_id.in_(customer_ids))
        .order_by(CustomerPhone.id)
    )
    out: dict[int, list[str]] = {}
    for customer_id, phone in result:
        out.setdefault(customer_id, []).append(phone)
    return out


async def cars_by_customer(
    session: AsyncSession, customer_ids: list[int]
) -> dict[int, list[CustomerCar]]:
    result = await session.scalars(
        select(CustomerCar)
        .where(CustomerCar.customer_id.in_(customer_ids))
        .order_by(CustomerCar.id)
    )
    out: dict[int, list[CustomerCar]] = {}
    for car in result:
        out.setdefault(car.customer_id, []).append(car)
    return out


async def add_car(session: AsyncSession, customer_id: int, **fields: object) -> CustomerCar:
    car = CustomerCar(customer_id=customer_id, **fields)
    session.add(car)
    await session.flush()
    return car


async def get_car(session: AsyncSession, customer_id: int, car_id: int) -> CustomerCar | None:
    return await session.scalar(
        select(CustomerCar).where(CustomerCar.id == car_id, CustomerCar.customer_id == customer_id)
    )


async def delete_car(session: AsyncSession, car: CustomerCar) -> None:
    await session.delete(car)
    await session.flush()


async def count(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(Customer)) or 0)


async def last_sales(
    session: AsyncSession, customer_ids: list[int]
) -> dict[int, tuple[datetime, int | None]]:
    """Per customer: date of the last non-cancelled sale and the car of the last sale with a car."""
    if not customer_ids:
        return {}
    cancelled = select(StockMove.cancels_move_id).where(StockMove.cancels_move_id.is_not(None))
    rows = await session.execute(
        select(StockMove.customer_id, StockMove.created_at, StockMove.car_id)
        .where(
            StockMove.customer_id.in_(customer_ids),
            StockMove.type == "sale",
            StockMove.id.not_in(cancelled),
        )
        .order_by(StockMove.id.desc())
    )
    dates: dict[int, datetime] = {}
    cars: dict[int, int] = {}
    for customer_id, created_at, car_id in rows:
        if customer_id is None:
            continue
        dates.setdefault(customer_id, created_at)
        if car_id is not None:
            cars.setdefault(customer_id, car_id)
    return {cid: (at, cars.get(cid)) for cid, at in dates.items()}


async def search(session: AsyncSession, q: str) -> list[Customer]:
    q = q.strip()
    stmt = select(Customer).limit(SEARCH_LIMIT)
    if not q:
        return list((await session.scalars(stmt.order_by(Customer.updated_at.desc()))).all())

    conditions: list[ColumnElement[bool]] = [Customer.name.ilike(f"%{q}%")]
    digits = "".join(ch for ch in q if ch.isascii() and ch.isdigit())
    if len(digits) >= MIN_PHONE_DIGITS:
        variants = [digits]
        if digits.startswith("8"):
            variants.append("7" + digits[1:])
        conditions.append(
            exists().where(
                CustomerPhone.customer_id == Customer.id,
                or_(*(CustomerPhone.phone.like(f"%{v}%") for v in variants)),
            )
        )
    plate = normalize_plate(q)
    if plate:
        conditions.append(
            exists().where(
                CustomerCar.customer_id == Customer.id, CustomerCar.plate.like(f"%{plate}%")
            )
        )
    conditions.append(
        exists().where(
            CustomerCar.customer_id == Customer.id, CustomerCar.vin.like(f"%{q.upper()}%")
        )
    )
    return list((await session.scalars(stmt.where(or_(*conditions)).order_by(Customer.name))).all())


async def history(
    session: AsyncSession, customer_id: int, car_id: int | None
) -> list[tuple[StockMove, StockItem, CustomerCar | None]]:
    """Non-cancelled sales and returns of the customer, newest first."""
    cancelled = select(StockMove.cancels_move_id).where(StockMove.cancels_move_id.is_not(None))
    stmt = (
        select(StockMove, StockItem, CustomerCar)
        .join(StockItem, StockItem.id == StockMove.item_id)
        .outerjoin(CustomerCar, CustomerCar.id == StockMove.car_id)
        .where(
            StockMove.customer_id == customer_id,
            StockMove.type.in_(("sale", "return")),
            StockMove.id.not_in(cancelled),
        )
        .order_by(StockMove.id.desc())
    )
    if car_id is not None:
        stmt = stmt.where(StockMove.car_id == car_id)
    return [(move, item, car) for move, item, car in await session.execute(stmt)]
