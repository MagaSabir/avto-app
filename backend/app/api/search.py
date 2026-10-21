from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.errors import ErrorOut
from app.schemas.search import StockSearchResult
from app.services import search as search_service

router = APIRouter(prefix="/search")

Session = Annotated[AsyncSession, Depends(get_session)]

_ERRORS: dict[int | str, dict[str, Any]] = {422: {"model": ErrorOut}}


@router.get("", response_model=StockSearchResult, responses=_ERRORS)
async def search_my_stock(q: str, session: Session) -> StockSearchResult:
    return await search_service.search_stock(session, q)
