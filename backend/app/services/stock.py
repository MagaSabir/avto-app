from decimal import Decimal
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.numbers import normalize_brand, normalize_number
from app.models.stock import MoveType, StockItem, StockMove
from app.repositories import stock as stock_repository
from app.schemas.stock import (
    AdjustmentIn,
    OperationResult,
    ReceiptIn,
    ReturnIn,
    SaleIn,
    StatusCounts,
    StockItemDetail,
    StockItemList,
    StockItemOut,
    StockItemPatch,
    StockMoveOut,
    WriteoffIn,
)
from app.services.errors import InsufficientStock, ItemNotFound, NothingChanged


async def receive(session: AsyncSession, data: ReceiptIn) -> OperationResult:
    number_norm = normalize_number(data.number)
    brand = normalize_brand(data.brand)
    item = await stock_repository.find_item_for_update(session, number_norm, brand)
    if item is None:
        item = StockItem(
            number_norm=number_norm,
            number_raw=data.number.strip(),
            brand=brand,
            name=data.name,
            qty=0,
            min_qty=1,
            cell=data.cell,
            purchase_price=data.purchase_price,
            markup=data.markup,
            sale_price=data.sale_price,
        )
        session.add(item)
        await session.flush()
    else:
        item.name = data.name
        item.cell = data.cell
        if data.price_policy == "update":
            item.purchase_price = data.purchase_price
            item.markup = data.markup
            item.sale_price = data.sale_price
    move = await stock_repository.add_move(
        session,
        item,
        "receipt",
        data.qty,
        price=data.purchase_price,
        supplier=data.supplier,
        comment=data.comment,
    )
    await session.commit()
    await session.refresh(item)
    await session.refresh(move)
    return OperationResult(
        item=StockItemOut.model_validate(item), move=StockMoveOut.model_validate(move)
    )


async def _finish(session: AsyncSession, item: StockItem, move: StockMove) -> OperationResult:
    await session.commit()
    await session.refresh(item)
    await session.refresh(move)
    return OperationResult(
        item=StockItemOut.model_validate(item), move=StockMoveOut.model_validate(move)
    )


async def _locked_item(session: AsyncSession, item_id: int) -> StockItem:
    item = await stock_repository.get_item_for_update(session, item_id)
    if item is None:
        raise ItemNotFound()
    return item


async def _decrease(
    session: AsyncSession,
    item_id: int,
    type: MoveType,
    qty: int,
    price: Decimal | None,
    comment: str | None,
) -> OperationResult:
    item = await _locked_item(session, item_id)
    if qty > item.qty:
        raise InsufficientStock(item.qty)
    move = await stock_repository.add_move(session, item, type, -qty, price=price, comment=comment)
    return await _finish(session, item, move)


async def sell(session: AsyncSession, item_id: int, data: SaleIn) -> OperationResult:
    return await _decrease(session, item_id, "sale", data.qty, data.price, data.comment)


async def accept_return(session: AsyncSession, item_id: int, data: ReturnIn) -> OperationResult:
    item = await _locked_item(session, item_id)
    move = await stock_repository.add_move(
        session, item, "return", data.qty, price=data.price, comment=data.comment
    )
    return await _finish(session, item, move)


async def write_off(session: AsyncSession, item_id: int, data: WriteoffIn) -> OperationResult:
    return await _decrease(session, item_id, "writeoff", data.qty, None, data.comment)


async def adjust(session: AsyncSession, item_id: int, data: AdjustmentIn) -> OperationResult:
    item = await _locked_item(session, item_id)
    delta = data.actual_qty - item.qty
    if delta == 0:
        raise NothingChanged()
    move = await stock_repository.add_move(session, item, "adjustment", delta, comment=data.comment)
    return await _finish(session, item, move)


async def list_items(
    session: AsyncSession, q: str, status: Literal["all", "low", "out"]
) -> StockItemList:
    items, total, low, out = await stock_repository.list_items(session, q, status)
    return StockItemList(
        items=[StockItemOut.model_validate(i) for i in items],
        counts=StatusCounts(all=total, low=low, out=out),
    )


async def get_detail(session: AsyncSession, item_id: int) -> StockItemDetail:
    item = await stock_repository.get_item(session, item_id)
    if item is None:
        raise ItemNotFound()
    receipt_at, supplier, sale_at, sold = await stock_repository.get_summary(session, item_id)
    return StockItemDetail(
        **StockItemOut.model_validate(item).model_dump(exclude={"status"}),
        last_receipt_at=receipt_at,
        last_receipt_supplier=supplier,
        last_sale_at=sale_at,
        sold_30d=sold,
    )


async def list_moves(session: AsyncSession, item_id: int) -> list[StockMoveOut]:
    if await stock_repository.get_item(session, item_id) is None:
        raise ItemNotFound()
    moves = await stock_repository.list_moves(session, item_id)
    return [StockMoveOut.model_validate(m) for m in moves]


async def lookup(session: AsyncSession, number: str) -> list[StockItemOut]:
    norm = normalize_number(number)
    if not norm:
        return []
    items = await stock_repository.lookup(session, norm)
    return [StockItemOut.model_validate(i) for i in items]


async def list_brands(session: AsyncSession) -> list[str]:
    return await stock_repository.list_brands(session)


async def list_suppliers(session: AsyncSession) -> list[str]:
    return await stock_repository.list_suppliers(session)


async def update_item(session: AsyncSession, item_id: int, data: StockItemPatch) -> StockItemOut:
    item = await _locked_item(session, item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    return StockItemOut.model_validate(item)


async def delete_item(session: AsyncSession, item_id: int) -> None:
    item = await _locked_item(session, item_id)
    await stock_repository.delete_item_with_moves(session, item)
    await session.commit()
