from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cart import CartItem


async def list_items(session: AsyncSession, user_id: int) -> list[CartItem]:
    result = await session.execute(
        select(CartItem)
        .where(CartItem.user_id == user_id)
        .order_by(CartItem.created_at, CartItem.id)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars())


async def get_for_update(session: AsyncSession, user_id: int, item_id: int) -> CartItem | None:
    result = await session.execute(
        select(CartItem)
        .where(CartItem.id == item_id, CartItem.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def find_for_update(
    session: AsyncSession,
    user_id: int,
    supplier: str,
    number_norm: str,
    brand: str,
    stock_id: str,
) -> CartItem | None:
    result = await session.execute(
        select(CartItem)
        .where(
            CartItem.user_id == user_id,
            CartItem.supplier == supplier,
            CartItem.number_norm == number_norm,
            CartItem.brand == brand,
            CartItem.stock_id == stock_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def delete_all(session: AsyncSession, user_id: int) -> None:
    await session.execute(delete(CartItem).where(CartItem.user_id == user_id))
