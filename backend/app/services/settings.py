from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSettings
from app.repositories import settings as settings_repository
from app.schemas.settings import SettingsPatch


async def get_settings(session: AsyncSession) -> AppSettings:
    return await settings_repository.get(session)


async def update_settings(session: AsyncSession, data: SettingsPatch) -> AppSettings:
    row = await settings_repository.get(session)
    row.default_markup = data.default_markup
    await session.commit()
    await session.refresh(row)
    return row
