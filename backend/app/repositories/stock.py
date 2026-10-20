from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import MoveType, StockItem, StockMove


async def get_item_for_update(session: AsyncSession, item_id: int) -> StockItem | None:
    result = await session.execute(
        select(StockItem)
        .where(StockItem.id == item_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


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
    )
    session.add(move)
    await session.flush()
    return move
