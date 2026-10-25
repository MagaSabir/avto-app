from collections.abc import Collection
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.brands import canonical_brand
from app.domain.numbers import normalize_number
from app.domain.pricing import sale_price
from app.repositories import stock as stock_repository
from app.schemas.search import (
    OfferOut,
    PartGroupOut,
    StockSearchItem,
    StockSearchResult,
    SupplierInfo,
    SupplierSearchResult,
    SupplierVariantsOut,
)
from app.schemas.stock import StockItemOut
from app.services import settings as settings_service
from app.services.errors import EmptyNumber, EmptyOrderCode, TooManyNumbers, VariantsNotSupported
from app.suppliers.base import Offer, Supplier, SupplierError, VariantsSupplier


async def _stock_items(session: AsyncSession, numbers: Collection[str]) -> list[StockSearchItem]:
    result: list[StockSearchItem] = []
    for item in await stock_repository.find_by_numbers(session, numbers):
        receipt_at, supplier, _sale_at, sold = await stock_repository.get_summary(session, item.id)
        result.append(
            StockSearchItem(
                **StockItemOut.model_validate(item).model_dump(exclude={"status"}),
                brand_key=canonical_brand(item.brand),
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


MAX_STOCK_NUMBERS = 200


async def search_stock_numbers(session: AsyncSession, numbers: list[str]) -> list[StockSearchItem]:
    if len(numbers) > MAX_STOCK_NUMBERS:
        raise TooManyNumbers()
    normalized = {n for n in map(normalize_number, numbers) if n}
    return await _stock_items(session, normalized) if normalized else []


def list_suppliers(suppliers: dict[str, Supplier]) -> list[SupplierInfo]:
    return [SupplierInfo(code=s.code, title=s.title) for s in suppliers.values()]


def _offer_out(o: Offer, markup: Decimal) -> OfferOut:
    return OfferOut(
        **{f: getattr(o, f) for f in OfferOut.model_fields if f != "price"},
        price=sale_price(o.purchase_price, markup),
    )


async def search_supplier(
    session: AsyncSession, supplier: Supplier, q: str, with_orders: bool = False
) -> SupplierSearchResult:
    number_norm = normalize_number(q)
    if not number_norm:
        raise EmptyNumber()
    markup = (await settings_service.get_settings(session)).default_markup
    try:
        result = await supplier.search(q, with_orders)
    except SupplierError as exc:
        return SupplierSearchResult(
            code=supplier.code,
            title=supplier.title,
            status="error",
            message=exc.message,
            markup=markup,
            groups=[],
            stock_matches=[],
        )
    groups = [
        PartGroupOut(
            brand=g.brand,
            number=g.number,
            number_norm=g.number_norm,
            name=g.name,
            is_requested=g.is_requested,
            key=g.key,
            analog_of=g.analog_of,
            offers=[_offer_out(o, markup) for o in g.offers],
        )
        for g in result.groups
    ]
    analogs = {g.number_norm for g in result.groups if not g.is_requested} - {number_norm}
    return SupplierSearchResult(
        code=supplier.code,
        title=supplier.title,
        status="ok",
        message=result.message,
        markup=markup,
        groups=groups,
        stock_matches=await _stock_items(session, analogs) if analogs else [],
    )


async def supplier_variants(
    session: AsyncSession, supplier: Supplier, order_code: str
) -> SupplierVariantsOut:
    if not isinstance(supplier, VariantsSupplier):
        raise VariantsNotSupported()
    code = order_code.strip()
    if not code:
        raise EmptyOrderCode()
    markup = (await settings_service.get_settings(session)).default_markup
    try:
        result = await supplier.variants(code)
    except SupplierError as exc:
        return SupplierVariantsOut(
            code=supplier.code,
            title=supplier.title,
            status="error",
            message=exc.message,
            markup=markup,
            offers=[],
        )
    return SupplierVariantsOut(
        code=supplier.code,
        title=supplier.title,
        status="ok",
        message=result.message,
        markup=markup,
        offers=[_offer_out(o, markup) for o in result.offers],
    )
