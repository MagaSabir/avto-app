from dataclasses import asdict
from datetime import date

from app.schemas.orders import OrdersData, OrdersOut
from app.services.errors import (
    IncompletePeriod,
    InvertedPeriod,
    OrdersNotSupported,
    OrdersQueryConflict,
    OrdersQueryRequired,
)
from app.suppliers.base import OrdersSupplier, Supplier, SupplierError


async def get_orders(
    supplier: Supplier,
    start: date | None,
    end: date | None,
    order_id: int | None,
) -> OrdersOut:
    has_period = start is not None or end is not None
    if has_period and order_id is not None:
        raise OrdersQueryConflict()
    if not has_period and order_id is None:
        raise OrdersQueryRequired()
    if (start is None) != (end is None):
        raise IncompletePeriod()
    if start is not None and end is not None and start > end:
        raise InvertedPeriod()
    if not isinstance(supplier, OrdersSupplier):
        raise OrdersNotSupported()
    try:
        result = await supplier.orders(start, end, order_id)
    except SupplierError as exc:
        return OrdersOut(
            code=supplier.code, title=supplier.title, status="error", message=exc.message, data=None
        )
    return OrdersOut(
        code=supplier.code,
        title=supplier.title,
        status="ok",
        message=None,
        data=OrdersData.model_validate(asdict(result)),
    )
