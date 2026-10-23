import asyncio
from decimal import Decimal
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.cart import cap_qty, offer_available, valid_qty
from app.domain.numbers import normalize_brand, normalize_number
from app.models.cart import CartItem
from app.repositories import cart as cart_repository
from app.schemas.cart import (
    CartItemIn,
    CartItemOut,
    CartOut,
    CartRefreshItem,
    CartRefreshOut,
)
from app.services.errors import CartItemNotFound, InvalidCartQty, UnknownSupplier, VariantNotChosen
from app.suppliers.base import (
    CartCheckSupplier,
    CartLine,
    Offer,
    OfferKind,
    Supplier,
    SupplierError,
)


def to_out(item: CartItem) -> CartItemOut:
    return CartItemOut(
        id=item.id,
        supplier=item.supplier,
        stock_id=item.stock_id,
        brand=item.brand,
        number=item.number_raw,
        number_norm=item.number_norm,
        name=item.name,
        warehouse=item.warehouse,
        multiplicity=item.multiplicity,
        qty=item.qty,
        available=item.available,
        delivery_days=item.delivery_days,
        delivery_from=item.delivery_from,
        delivery_to=item.delivery_to,
        kind=cast(OfferKind, item.kind),  # column holds only Offer.kind values
        kind_code=item.kind_code,
        price=item.price,
        sum=item.price * item.qty,
        order_code=item.order_code,
    )


async def get_cart(session: AsyncSession, user_id: int) -> CartOut:
    items = [to_out(i) for i in await cart_repository.list_items(session, user_id)]
    return CartOut(items=items, total=sum((i.sum for i in items), Decimal("0")))


async def add_item(
    session: AsyncSession, user_id: int, data: CartItemIn, suppliers: dict[str, Supplier]
) -> CartItemOut:
    if data.supplier not in suppliers:
        raise UnknownSupplier()
    if data.kind == "variants":
        raise VariantNotChosen()
    available = offer_available(data.kind, data.available)
    if not valid_qty(data.qty, data.multiplicity, available):
        raise InvalidCartQty(data.multiplicity, available)
    number_norm = normalize_number(data.number)
    brand = normalize_brand(data.brand)
    item = await cart_repository.find_for_update(
        session, user_id, data.supplier, number_norm, brand, data.stock_id
    )
    qty = data.qty
    if item is None:
        item = CartItem(
            user_id=user_id,
            supplier=data.supplier,
            stock_id=data.stock_id,
            number_norm=number_norm,
            brand=brand,
        )
        session.add(item)
    else:
        qty = cap_qty(item.qty + data.qty, data.multiplicity, available)
        if qty == 0:
            raise InvalidCartQty(data.multiplicity, available)
    item.number_raw = data.number.strip()
    item.name = data.name
    item.warehouse = data.warehouse
    item.multiplicity = data.multiplicity
    item.qty = qty
    item.available = available
    item.delivery_days = data.delivery_days
    item.delivery_from = data.delivery_from
    item.delivery_to = data.delivery_to
    item.kind = data.kind
    item.kind_code = data.kind_code
    item.price = data.price
    item.order_code = data.order_code
    await session.commit()
    await session.refresh(item)
    return to_out(item)


async def _locked(session: AsyncSession, user_id: int, item_id: int) -> CartItem:
    item = await cart_repository.get_for_update(session, user_id, item_id)
    if item is None:
        raise CartItemNotFound()
    return item


async def set_qty(session: AsyncSession, user_id: int, item_id: int, qty: int) -> CartItemOut:
    item = await _locked(session, user_id, item_id)
    if not valid_qty(qty, item.multiplicity, item.available):
        raise InvalidCartQty(item.multiplicity, item.available)
    item.qty = qty
    await session.commit()
    await session.refresh(item)
    return to_out(item)


async def remove_item(session: AsyncSession, user_id: int, item_id: int) -> None:
    item = await _locked(session, user_id, item_id)
    await session.delete(item)
    await session.commit()


async def clear(session: AsyncSession, user_id: int) -> None:
    await cart_repository.delete_all(session, user_id)
    await session.commit()


_REFRESH_CONCURRENCY = 3


async def refresh(
    session: AsyncSession, user_id: int, suppliers: dict[str, Supplier]
) -> CartRefreshOut:
    items = await cart_repository.list_items(session, user_id)
    # plain snapshot: the transaction ends before the slow supplier calls
    ids = [item.id for item in items]
    groups: dict[tuple[str, str], list[int]] = {}
    lines: dict[tuple[str, str], list[CartLine]] = {}
    for item in items:
        key = (item.supplier, item.number_norm)
        groups.setdefault(key, []).append(item.id)
        lines.setdefault(key, []).append(
            CartLine(item.stock_id, item.brand, item.number_raw, item.order_code)
        )
    await session.commit()

    semaphore = asyncio.Semaphore(_REFRESH_CONCURRENCY)

    async def query(
        supplier_code: str, group: list[CartLine]
    ) -> dict[str, Offer | None] | SupplierError:
        supplier = suppliers.get(supplier_code)
        if supplier is None:
            return SupplierError(UnknownSupplier().message)
        if not isinstance(supplier, CartCheckSupplier):
            return SupplierError("Поставщик не поддерживает проверку цен")
        async with semaphore:
            try:
                return await supplier.check_offers(group)
            except SupplierError as e:
                return e

    keys = list(groups)
    responses = await asyncio.gather(*(query(k[0], lines[k]) for k in keys))

    # rows may have been removed meanwhile: lock and update only those still present
    current = {
        item.id: item for item in await cart_repository.list_for_update(session, user_id, ids)
    }
    out: dict[int, CartRefreshItem] = {}
    error: str | None = None
    for key, response in zip(keys, responses, strict=True):
        if isinstance(response, SupplierError):
            error = error or response.message
        for item_id in groups[key]:
            row = current.get(item_id)
            if row is None:
                continue
            offer = None if isinstance(response, SupplierError) else response.get(row.stock_id)
            if offer is None:
                out[row.id] = CartRefreshItem(
                    id=row.id,
                    state="unknown" if isinstance(response, SupplierError) else "gone",
                    price=row.price,
                    previous_price=None,
                    available=row.available,
                )
                continue
            previous = row.price if row.price != offer.purchase_price else None
            row.price = offer.purchase_price
            available = offer_available(offer.kind, offer.qty)
            row.available = available
            row.warehouse = offer.warehouse
            row.delivery_days = offer.delivery_days
            row.delivery_from = offer.delivery_from
            row.delivery_to = offer.delivery_to
            row.kind = offer.kind
            row.kind_code = offer.kind_code
            row.multiplicity = offer.multiplicity
            out[row.id] = CartRefreshItem(
                id=row.id,
                state="ok",
                price=offer.purchase_price,
                previous_price=previous,
                available=available,
            )
    await session.commit()
    return CartRefreshOut(
        status="error" if error is not None else "ok",
        message=error,
        items=[out[i] for i in ids if i in out],
    )
