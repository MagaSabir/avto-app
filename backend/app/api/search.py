from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.errors import ErrorOut
from app.schemas.search import (
    StockSearchItem,
    StockSearchResult,
    SupplierInfo,
    SupplierSearchResult,
)
from app.services import search as search_service
from app.services.errors import SupplierNotFound
from app.suppliers import get_suppliers
from app.suppliers.base import Supplier

router = APIRouter(prefix="/search")

Session = Annotated[AsyncSession, Depends(get_session)]

Suppliers = Annotated[dict[str, Supplier], Depends(get_suppliers)]

_ERRORS: dict[int | str, dict[str, Any]] = {422: {"model": ErrorOut}}


@router.get("", response_model=StockSearchResult, responses=_ERRORS)
async def search_my_stock(q: str, session: Session) -> StockSearchResult:
    return await search_service.search_stock(session, q)


@router.get("/stock", response_model=list[StockSearchItem], responses=_ERRORS)
async def search_stock_by_numbers(
    session: Session, numbers: Annotated[list[str] | None, Query()] = None
) -> list[StockSearchItem]:
    return await search_service.search_stock_numbers(session, numbers or [])


@router.get("/suppliers", response_model=list[SupplierInfo])
async def list_suppliers(suppliers: Suppliers) -> list[SupplierInfo]:
    return search_service.list_suppliers(suppliers)


@router.get(
    "/suppliers/{code}",
    response_model=SupplierSearchResult,
    responses={404: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
async def search_supplier(
    code: str, q: str, session: Session, suppliers: Suppliers, with_orders: bool = False
) -> SupplierSearchResult:
    supplier = suppliers.get(code)
    if supplier is None:
        raise SupplierNotFound()
    return await search_service.search_supplier(session, supplier, q, with_orders)
