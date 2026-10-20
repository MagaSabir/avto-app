from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSettings


async def get(session: AsyncSession) -> AppSettings:
    row = await session.get(AppSettings, 1)
    if row is None:
        raise RuntimeError("Settings row is missing")
    return row
