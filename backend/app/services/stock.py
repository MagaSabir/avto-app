from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.numbers import normalize_brand, normalize_number
from app.domain.stock import CancelBlock, cancel_block
from app.models.auth import User
from app.models.stock import MoveType, Payment, StockItem, StockMove
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
from app.services.errors import (
    InsufficientStock,
    ItemNotFound,
    MoveNotCancellable,
    MoveNotFound,
    NothingChanged,
)

_CANCEL_MESSAGES: dict[CancelBlock, str] = {
    "is_cancel": "Отмену отменить нельзя",
    "already_cancelled": "Операция уже отменена",
    "not_last": "Это уже не последняя операция",
    "too_old": "Прошло больше 24 часов",
}


def _move_out(
    move: StockMove, login: str | None, *, cancelled: bool, cancellable: bool
) -> StockMoveOut:
    return StockMoveOut(
        id=move.id,
        type=move.type,
        qty_delta=move.qty_delta,
        qty_after=move.qty_after,
        price=move.price,
        supplier=move.supplier,
        comment=move.comment,
        created_at=move.created_at,
        cost=move.cost,
        payment=move.payment,
        user=login,
        cancels_move_id=move.cancels_move_id,
        cancelled=cancelled,
        cancellable=cancellable,
    )


async def receive(session: AsyncSession, data: ReceiptIn, user: User | None) -> OperationResult:
    number_norm = normalize_number(data.number)
    brand = normalize_brand(data.brand)
    item = await stock_repository.find_item_for_update(session, number_norm, brand)
    prev: tuple[Decimal, Decimal, Decimal] | None = None
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
        prev = (item.purchase_price, item.markup, item.sale_price)
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
        user_id=user.id if user else None,
        prev_purchase_price=prev[0] if prev else None,
        prev_markup=prev[1] if prev else None,
        prev_sale_price=prev[2] if prev else None,
    )
    return await _finish(session, item, move, user)


async def _finish(
    session: AsyncSession, item: StockItem, move: StockMove, user: User | None
) -> OperationResult:
    login = user.login if user else None
    await session.commit()
    await session.refresh(item)
    await session.refresh(move)
    return OperationResult(
        item=StockItemOut.model_validate(item),
        move=_move_out(move, login, cancelled=False, cancellable=move.type != "cancel"),
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
    user: User | None,
    payment: Payment | None = None,
) -> OperationResult:
    item = await _locked_item(session, item_id)
    if qty > item.qty:
        raise InsufficientStock(item.qty)
    move = await stock_repository.add_move(
        session,
        item,
        type,
        -qty,
        price=price,
        comment=comment,
        user_id=user.id if user else None,
        cost=item.purchase_price,
        payment=payment,
    )
    return await _finish(session, item, move, user)


async def sell(
    session: AsyncSession, item_id: int, data: SaleIn, user: User | None
) -> OperationResult:
    return await _decrease(
        session, item_id, "sale", data.qty, data.price, data.comment, user, data.payment
    )


async def accept_return(
    session: AsyncSession, item_id: int, data: ReturnIn, user: User | None
) -> OperationResult:
    item = await _locked_item(session, item_id)
    move = await stock_repository.add_move(
        session,
        item,
        "return",
        data.qty,
        price=data.price,
        comment=data.comment,
        user_id=user.id if user else None,
        cost=item.purchase_price,
        payment=data.payment,
    )
    return await _finish(session, item, move, user)


async def write_off(
    session: AsyncSession, item_id: int, data: WriteoffIn, user: User | None
) -> OperationResult:
    return await _decrease(session, item_id, "writeoff", data.qty, None, data.comment, user)


async def adjust(
    session: AsyncSession, item_id: int, data: AdjustmentIn, user: User | None
) -> OperationResult:
    item = await _locked_item(session, item_id)
    delta = data.actual_qty - item.qty
    if delta == 0:
        raise NothingChanged()
    move = await stock_repository.add_move(
        session,
        item,
        "adjustment",
        delta,
        comment=data.comment,
        user_id=user.id if user else None,
    )
    return await _finish(session, item, move, user)


async def cancel_move(session: AsyncSession, move_id: int, user: User | None) -> OperationResult:
    move = await stock_repository.get_move(session, move_id)
    if move is None:
        raise MoveNotFound()
    item = await _locked_item(session, move.item_id)
    last = await stock_repository.last_move(session, item.id)
    blocked = cancel_block(
        move_type=move.type,
        created_at=move.created_at,
        now=datetime.now(UTC),
        is_last=last is not None and last.id == move.id,
        cancelled=await stock_repository.is_cancelled(session, move.id),
    )
    if blocked is not None:
        raise MoveNotCancellable(_CANCEL_MESSAGES[blocked])
    if (
        move.type == "receipt"
        and move.prev_purchase_price is not None
        and move.prev_markup is not None
        and move.prev_sale_price is not None
    ):
        item.purchase_price = move.prev_purchase_price
        item.markup = move.prev_markup
        item.sale_price = move.prev_sale_price
    cancel = await stock_repository.add_move(
        session,
        item,
        "cancel",
        -move.qty_delta,
        user_id=user.id if user else None,
        cancels_move_id=move.id,
    )
    return await _finish(session, item, cancel, user)


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
    rows = await stock_repository.list_moves(session, item_id)
    cancelled_ids = {m.cancels_move_id for m, _ in rows if m.cancels_move_id is not None}
    now = datetime.now(UTC)
    result: list[StockMoveOut] = []
    for index, (move, login) in enumerate(rows):
        cancelled = move.id in cancelled_ids
        blocked = cancel_block(
            move_type=move.type,
            created_at=move.created_at,
            now=now,
            is_last=index == 0,
            cancelled=cancelled,
        )
        result.append(_move_out(move, login, cancelled=cancelled, cancellable=blocked is None))
    return result


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
