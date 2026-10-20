from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.errors import ErrorOut
from app.schemas.stock import (
    AdjustmentIn,
    OperationResult,
    ReceiptIn,
    ReturnIn,
    SaleIn,
    WriteoffIn,
)
from app.services import stock as stock_service

router = APIRouter(prefix="/stock")

Session = Annotated[AsyncSession, Depends(get_session)]


@router.post("/receipts", status_code=201, response_model=OperationResult)
async def create_receipt(data: ReceiptIn, session: Session) -> OperationResult:
    return await stock_service.receive(session, data)


_ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorOut},
    409: {"model": ErrorOut},
    422: {"model": ErrorOut},
}


@router.post(
    "/items/{item_id}/sales",
    status_code=201,
    response_model=OperationResult,
    responses=_ERRORS,
)
async def create_sale(item_id: int, data: SaleIn, session: Session) -> OperationResult:
    return await stock_service.sell(session, item_id, data)


@router.post(
    "/items/{item_id}/returns",
    status_code=201,
    response_model=OperationResult,
    responses=_ERRORS,
)
async def create_return(item_id: int, data: ReturnIn, session: Session) -> OperationResult:
    return await stock_service.accept_return(session, item_id, data)


@router.post(
    "/items/{item_id}/writeoffs",
    status_code=201,
    response_model=OperationResult,
    responses=_ERRORS,
)
async def create_writeoff(item_id: int, data: WriteoffIn, session: Session) -> OperationResult:
    return await stock_service.write_off(session, item_id, data)


@router.post(
    "/items/{item_id}/adjustments",
    status_code=201,
    response_model=OperationResult,
    responses=_ERRORS,
)
async def create_adjustment(item_id: int, data: AdjustmentIn, session: Session) -> OperationResult:
    return await stock_service.adjust(session, item_id, data)
