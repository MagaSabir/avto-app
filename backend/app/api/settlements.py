from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from app.schemas.errors import ErrorOut
from app.schemas.settlements import SettlementsOut
from app.services import settlements as settlements_service
from app.services.errors import SupplierNotFound
from app.suppliers import get_suppliers
from app.suppliers.base import Supplier

router = APIRouter(prefix="/suppliers")

Suppliers = Annotated[dict[str, Supplier], Depends(get_suppliers)]

SettlementStatus = Literal["Проведено", "Оплачено", "Не оплачено", "Просрочено", "Обрабатывается"]


@router.get(
    "/{code}/settlements",
    response_model=SettlementsOut,
    responses={404: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
async def get_settlements(
    code: str,
    suppliers: Suppliers,
    page: Annotated[int, Query(ge=0)] = 0,
    status: SettlementStatus | None = None,
    start: date | None = None,
    end: date | None = None,
) -> SettlementsOut:
    supplier = suppliers.get(code)
    if supplier is None:
        raise SupplierNotFound()
    return await settlements_service.get_settlements(supplier, page, status, start, end)
