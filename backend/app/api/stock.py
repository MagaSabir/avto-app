from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.stock import OperationResult, ReceiptIn
from app.services import stock as stock_service

router = APIRouter(prefix="/stock")

Session = Annotated[AsyncSession, Depends(get_session)]


@router.post("/receipts", status_code=201, response_model=OperationResult)
async def create_receipt(data: ReceiptIn, session: Session) -> OperationResult:
    return await stock_service.receive(session, data)
