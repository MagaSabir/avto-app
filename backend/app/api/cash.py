from datetime import date
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.schemas.cash import CashOut
from app.schemas.errors import ErrorOut
from app.services import cash as cash_service

router = APIRouter(prefix="/cash")

Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=CashOut, responses={422: {"model": ErrorOut}})
async def get_cash(session: Session, start: date, end: date) -> CashOut:
    tz = ZoneInfo(get_settings().shop_timezone)
    return await cash_service.get_cash(session, start, end, tz)
