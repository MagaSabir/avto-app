from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.errors import ErrorOut
from app.schemas.orders import OrdersOut
from app.services import orders as orders_service
from app.services.errors import SupplierNotFound
from app.suppliers import get_suppliers
from app.suppliers.base import Supplier

router = APIRouter(prefix="/suppliers")

Suppliers = Annotated[dict[str, Supplier], Depends(get_suppliers)]


@router.get(
    "/{code}/orders",
    response_model=OrdersOut,
    responses={404: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
async def get_orders(
    code: str,
    suppliers: Suppliers,
    start: date | None = None,
    end: date | None = None,
    order_id: Annotated[int | None, Query(gt=0)] = None,
) -> OrdersOut:
    supplier = suppliers.get(code)
    if supplier is None:
        raise SupplierNotFound()
    return await orders_service.get_orders(supplier, start, end, order_id)
