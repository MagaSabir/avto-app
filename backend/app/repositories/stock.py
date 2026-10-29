from collections.abc import Collection
from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import ColumnElement, and_, delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.numbers import normalize_number
from app.models.auth import User
from app.models.customers import Customer, CustomerCar
from app.models.stock import MoveType, Payment, StockItem, StockMove


async def get_item_for_update(session: AsyncSession, item_id: int) -> StockItem | None:
    result = await session.execute(
        select(StockItem)
        .where(StockItem.id == item_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def get_move(session: AsyncSession, move_id: int) -> StockMove | None:
    return await session.get(StockMove, move_id)


async def last_move(session: AsyncSession, item_id: int) -> StockMove | None:
    result = await session.execute(
        select(StockMove).where(StockMove.item_id == item_id).order_by(StockMove.id.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def is_cancelled(session: AsyncSession, move_id: int) -> bool:
    found = await session.scalar(
        select(StockMove.id).where(StockMove.cancels_move_id == move_id).limit(1)
    )
    return found is not None


async def find_item_for_update(
    session: AsyncSession, number_norm: str, brand: str
) -> StockItem | None:
    result = await session.execute(
        select(StockItem)
        .where(StockItem.number_norm == number_norm, StockItem.brand == brand)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def add_move(
    session: AsyncSession,
    item: StockItem,
    type: MoveType,
    qty_delta: int,
    price: Decimal | None = None,
    supplier: str | None = None,
    comment: str | None = None,
    *,
    user_id: int | None = None,
    cost: Decimal | None = None,
    payment: Payment | None = None,
    cancels_move_id: int | None = None,
    customer_id: int | None = None,
    car_id: int | None = None,
    prev_purchase_price: Decimal | None = None,
    prev_markup: Decimal | None = None,
    prev_sale_price: Decimal | None = None,
) -> StockMove:
    item.qty = item.qty + qty_delta
    move = StockMove(
        item_id=item.id,
        type=type,
        qty_delta=qty_delta,
        qty_after=item.qty,
        price=price,
        supplier=supplier,
        comment=comment,
        user_id=user_id,
        cost=cost,
        payment=payment,
        cancels_move_id=cancels_move_id,
        customer_id=customer_id,
        car_id=car_id,
        prev_purchase_price=prev_purchase_price,
        prev_markup=prev_markup,
        prev_sale_price=prev_sale_price,
    )
    session.add(move)
    await session.flush()
    return move


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_filter(q: str) -> ColumnElement[bool] | None:
    q = q.strip()
    if not q:
        return None
    pattern = f"%{_escape_like(q)}%"
    conditions = [
        StockItem.brand.ilike(pattern, escape="\\"),
        StockItem.name.ilike(pattern, escape="\\"),
    ]
    norm = normalize_number(q)
    if norm:
        conditions.append(StockItem.number_norm.like(f"%{_escape_like(norm)}%", escape="\\"))
    return or_(*conditions)


_OUT = StockItem.qty == 0
_LOW = and_(StockItem.qty > 0, StockItem.qty <= StockItem.min_qty)


async def list_items(
    session: AsyncSession, q: str, status: Literal["all", "low", "out"]
) -> tuple[list[StockItem], int, int, int]:
    search = _search_filter(q)
    stmt = select(StockItem).order_by(StockItem.brand, StockItem.number_norm)
    counts = select(
        func.count(),
        func.count().filter(_LOW),
        func.count().filter(_OUT),
    ).select_from(StockItem)
    if search is not None:
        stmt = stmt.where(search)
        counts = counts.where(search)
    if status == "low":
        stmt = stmt.where(_LOW)
    elif status == "out":
        stmt = stmt.where(_OUT)
    items = list((await session.execute(stmt)).scalars())
    total, low, out = (await session.execute(counts)).one()
    return items, total, low, out


async def get_item(session: AsyncSession, item_id: int) -> StockItem | None:
    return await session.get(StockItem, item_id)


async def get_summary(
    session: AsyncSession, item_id: int
) -> tuple[datetime | None, str | None, datetime | None, int]:
    live = StockMove.id.not_in(
        select(StockMove.cancels_move_id).where(StockMove.cancels_move_id.is_not(None))
    )
    receipt = (
        await session.execute(
            select(StockMove.created_at, StockMove.supplier)
            .where(StockMove.item_id == item_id, StockMove.type == "receipt", live)
            .order_by(StockMove.id.desc())
            .limit(1)
        )
    ).first()
    last_sale = await session.scalar(
        select(func.max(StockMove.created_at)).where(
            StockMove.item_id == item_id, StockMove.type == "sale", live
        )
    )
    net = await session.scalar(
        select(func.coalesce(func.sum(StockMove.qty_delta), 0)).where(
            StockMove.item_id == item_id,
            StockMove.type.in_(("sale", "return")),
            live,
            StockMove.created_at >= func.now() - text("interval '30 days'"),
        )
    )
    sold = max(0, -int(net or 0))
    return (
        receipt[0] if receipt else None,
        receipt[1] if receipt else None,
        last_sale,
        sold,
    )


async def list_moves(
    session: AsyncSession, item_id: int
) -> list[tuple[StockMove, str | None, Customer | None, CustomerCar | None]]:
    result = await session.execute(
        select(StockMove, User.login, Customer, CustomerCar)
        .outerjoin(User, User.id == StockMove.user_id)
        .outerjoin(Customer, Customer.id == StockMove.customer_id)
        .outerjoin(CustomerCar, CustomerCar.id == StockMove.car_id)
        .where(StockMove.item_id == item_id)
        .order_by(StockMove.id.desc())
    )
    return [(move, login, customer, car) for move, login, customer, car in result.all()]


async def delete_item_with_moves(session: AsyncSession, item: StockItem) -> None:
    await session.execute(delete(StockMove).where(StockMove.item_id == item.id))
    await session.delete(item)
    await session.flush()


async def lookup(session: AsyncSession, number_norm: str) -> list[StockItem]:
    result = await session.execute(
        select(StockItem).where(StockItem.number_norm == number_norm).order_by(StockItem.brand)
    )
    return list(result.scalars())


async def find_by_numbers(session: AsyncSession, numbers: Collection[str]) -> list[StockItem]:
    if not numbers:
        return []
    result = await session.execute(
        select(StockItem)
        .where(StockItem.number_norm.in_(numbers))
        .order_by(StockItem.brand, StockItem.number_norm)
    )
    return list(result.scalars())


async def list_brands(session: AsyncSession) -> list[str]:
    result = await session.execute(select(StockItem.brand).distinct().order_by(StockItem.brand))
    return list(result.scalars())


async def list_suppliers(session: AsyncSession) -> list[str]:
    result = await session.execute(
        select(StockMove.supplier)
        .where(
            StockMove.type == "receipt", StockMove.supplier.is_not(None), StockMove.supplier != ""
        )
        .distinct()
        .order_by(StockMove.supplier)
    )
    return [s for s in result.scalars() if s]
