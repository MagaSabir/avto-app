import asyncio
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.cart import cap_qty, valid_qty
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
from app.services.errors import CartItemNotFound, InvalidCartQty, UnknownSupplier
from app.suppliers.base import Offer, Supplier, SupplierError, SupplierResult


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
        kind=item.kind,
        kind_code=item.kind_code,
        price=item.price,
        sum=item.price * item.qty,
    )


async def get_cart(session: AsyncSession, user_id: int) -> CartOut:
    items = [to_out(i) for i in await cart_repository.list_items(session, user_id)]
    return CartOut(items=items, total=sum((i.sum for i in items), Decimal("0")))


async def add_item(
    session: AsyncSession, user_id: int, data: CartItemIn, suppliers: dict[str, Supplier]
) -> CartItemOut:
    if data.supplier not in suppliers:
        raise UnknownSupplier()
    if not valid_qty(data.qty, data.multiplicity, data.available):
        raise InvalidCartQty(data.multiplicity, data.available)
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
        qty = cap_qty(item.qty + data.qty, data.multiplicity, data.available)
        if qty == 0:
            raise InvalidCartQty(data.multiplicity, data.available)
    item.number_raw = data.number.strip()
    item.name = data.name
    item.warehouse = data.warehouse
    item.multiplicity = data.multiplicity
    item.qty = qty
    item.available = data.available
    item.delivery_days = data.delivery_days
    item.delivery_from = data.delivery_from
    item.delivery_to = data.delivery_to
    item.kind = data.kind
    item.kind_code = data.kind_code
    item.price = data.price
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


def _find_offer(result: SupplierResult, item: CartItem) -> Offer | None:
    for group in result.groups:
        if normalize_brand(group.brand) == item.brand and group.number_norm == item.number_norm:
            for offer in group.offers:
                if offer.stock_id == item.stock_id:
                    return offer
    return None


async def refresh(
    session: AsyncSession, user_id: int, suppliers: dict[str, Supplier]
) -> CartRefreshOut:
    items = await cart_repository.list_items(session, user_id)
    groups: dict[tuple[str, str], list[CartItem]] = {}
    for item in items:
        groups.setdefault((item.supplier, item.number_norm), []).append(item)

    semaphore = asyncio.Semaphore(_REFRESH_CONCURRENCY)

    async def query(supplier_code: str, number: str) -> SupplierResult | SupplierError:
        supplier = suppliers.get(supplier_code)
        if supplier is None:
            return SupplierError("Поставщик не подключён")
        async with semaphore:
            try:
                return await supplier.search(number)
            except SupplierError as e:
                return e

    keys = list(groups)
    responses = await asyncio.gather(*(query(k[0], groups[k][0].number_raw) for k in keys))

    out: dict[int, CartRefreshItem] = {}
    error: str | None = None
    message: str | None = None
    for key, response in zip(keys, responses, strict=True):
        if isinstance(response, SupplierError):
            error = error or response.message
            for item in groups[key]:
                out[item.id] = CartRefreshItem(
                    id=item.id,
                    state="unknown",
                    price=item.price,
                    previous_price=None,
                    available=item.available,
                )
            continue
        message = response.message
        for item in groups[key]:
            offer = _find_offer(response, item)
            if offer is None:
                out[item.id] = CartRefreshItem(
                    id=item.id,
                    state="gone",
                    price=item.price,
                    previous_price=None,
                    available=item.available,
                )
                continue
            previous = item.price if item.price != offer.purchase_price else None
            item.price = offer.purchase_price
            item.available = offer.qty
            item.warehouse = offer.warehouse
            item.delivery_days = offer.delivery_days
            item.delivery_from = offer.delivery_from
            item.delivery_to = offer.delivery_to
            item.kind = offer.kind
            item.kind_code = offer.kind_code
            item.multiplicity = offer.multiplicity
            out[item.id] = CartRefreshItem(
                id=item.id,
                state="ok",
                price=offer.purchase_price,
                previous_price=previous,
                available=offer.qty,
            )
    await session.commit()
    if error is not None:
        return CartRefreshOut(status="error", message=error, items=[out[i.id] for i in items])
    return CartRefreshOut(status="ok", message=message, items=[out[i.id] for i in items])
