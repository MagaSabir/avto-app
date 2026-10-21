from collections.abc import Collection

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.numbers import normalize_number
from app.repositories import stock as stock_repository
from app.schemas.search import StockSearchItem, StockSearchResult
from app.schemas.stock import StockItemOut
from app.services.errors import EmptyNumber


async def _stock_items(session: AsyncSession, numbers: Collection[str]) -> list[StockSearchItem]:
    result: list[StockSearchItem] = []
    for item in await stock_repository.find_by_numbers(session, numbers):
        receipt_at, supplier, _sale_at, sold = await stock_repository.get_summary(session, item.id)
        result.append(
            StockSearchItem(
                **StockItemOut.model_validate(item).model_dump(exclude={"status"}),
                last_receipt_at=receipt_at,
                last_receipt_supplier=supplier,
                sold_30d=sold,
            )
        )
    return result


async def search_stock(session: AsyncSession, q: str) -> StockSearchResult:
    number_norm = normalize_number(q)
    if not number_norm:
        raise EmptyNumber()
    items = await _stock_items(session, [number_norm])
    return StockSearchResult(query=q, number_norm=number_norm, items=items)
