from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.errors import ErrorOut
from app.schemas.stock import (
    AdjustmentIn,
    OperationResult,
    ReceiptIn,
    ReturnIn,
    SaleIn,
    StockItemDetail,
    StockItemList,
    StockItemOut,
    StockItemPatch,
    StockMoveOut,
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


@router.get("/items", response_model=StockItemList)
async def list_items(
    session: Session, q: str = "", status: Literal["all", "low", "out"] = "all"
) -> StockItemList:
    return await stock_service.list_items(session, q, status)


@router.get("/items/{item_id}", response_model=StockItemDetail, responses=_ERRORS)
async def get_item(item_id: int, session: Session) -> StockItemDetail:
    return await stock_service.get_detail(session, item_id)


@router.get("/items/{item_id}/moves", response_model=list[StockMoveOut], responses=_ERRORS)
async def list_moves(item_id: int, session: Session) -> list[StockMoveOut]:
    return await stock_service.list_moves(session, item_id)


@router.patch("/items/{item_id}", response_model=StockItemOut, responses=_ERRORS)
async def update_item(item_id: int, data: StockItemPatch, session: Session) -> StockItemOut:
    return await stock_service.update_item(session, item_id, data)


@router.get("/lookup", response_model=list[StockItemOut])
async def lookup(session: Session, number: Annotated[str, Query()] = "") -> list[StockItemOut]:
    return await stock_service.lookup(session, number)


@router.get("/brands", response_model=list[str])
async def list_brands(session: Session) -> list[str]:
    return await stock_service.list_brands(session)


@router.get("/suppliers", response_model=list[str])
async def list_suppliers(session: Session) -> list[str]:
    return await stock_service.list_suppliers(session)
