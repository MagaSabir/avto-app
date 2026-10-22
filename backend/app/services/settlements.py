from dataclasses import asdict
from datetime import date

from app.schemas.settlements import SettlementsData, SettlementsOut
from app.services.errors import IncompletePeriod, InvertedPeriod, SettlementsNotSupported
from app.suppliers.base import SettlementsSupplier, Supplier, SupplierError


async def get_settlements(
    supplier: Supplier,
    page: int,
    status: str | None = None,
    start: date | None = None,
    end: date | None = None,
) -> SettlementsOut:
    if (start is None) != (end is None):
        raise IncompletePeriod()
    if start is not None and end is not None and start > end:
        raise InvertedPeriod()
    if not isinstance(supplier, SettlementsSupplier):
        raise SettlementsNotSupported()
    try:
        result = await supplier.settlements(page, status, start, end)
    except SupplierError as exc:
        return SettlementsOut(
            code=supplier.code, title=supplier.title, status="error", message=exc.message, data=None
        )
    return SettlementsOut(
        code=supplier.code,
        title=supplier.title,
        status="ok",
        message=None,
        data=SettlementsData.model_validate(asdict(result)),
    )
