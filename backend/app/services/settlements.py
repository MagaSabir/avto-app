from dataclasses import asdict

from app.schemas.settlements import SettlementsData, SettlementsOut
from app.services.errors import SettlementsNotSupported
from app.suppliers.base import SettlementsSupplier, Supplier, SupplierError


async def get_settlements(supplier: Supplier, page: int) -> SettlementsOut:
    if not isinstance(supplier, SettlementsSupplier):
        raise SettlementsNotSupported()
    try:
        result = await supplier.settlements(page)
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
