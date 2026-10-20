from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.settings import SettingsOut, SettingsPatch
from app.services import settings as settings_service

router = APIRouter()


@router.get("/settings", response_model=SettingsOut)
async def read_settings(session: Annotated[AsyncSession, Depends(get_session)]) -> SettingsOut:
    return SettingsOut.model_validate(await settings_service.get_settings(session))


@router.patch("/settings", response_model=SettingsOut)
async def patch_settings(
    data: SettingsPatch, session: Annotated[AsyncSession, Depends(get_session)]
) -> SettingsOut:
    return SettingsOut.model_validate(await settings_service.update_settings(session, data))
