from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.stock import StockItem, StockMove


async def period_moves(
    session: AsyncSession, start_utc: datetime, end_utc: datetime
) -> list[tuple[StockMove, StockItem, str | None]]:
    """Non-cancelled sales, returns and write-offs in [start_utc, end_utc), newest first."""
    cancelled = select(StockMove.cancels_move_id).where(StockMove.cancels_move_id.is_not(None))
    result = await session.execute(
        select(StockMove, StockItem, User.login)
        .join(StockItem, StockItem.id == StockMove.item_id)
        .outerjoin(User, User.id == StockMove.user_id)
        .where(
            StockMove.type.in_(("sale", "return", "writeoff")),
            StockMove.created_at >= start_utc,
            StockMove.created_at < end_utc,
            StockMove.id.not_in(cancelled),
        )
        .order_by(StockMove.id.desc())
    )
    return [(move, item, login) for move, item, login in result]
