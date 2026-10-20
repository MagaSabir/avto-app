from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.health import HealthError, HealthOk
from app.services import health as health_service

router = APIRouter()


@router.get("/health", response_model=HealthOk, responses={503: {"model": HealthError}})
async def health(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> HealthOk | JSONResponse:
    if await health_service.is_database_up(session):
        return HealthOk()
    error = HealthError(message="Database unavailable")
    return JSONResponse(status_code=503, content=error.model_dump())
