from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.numbers import normalize_brand, normalize_number
from app.models.stock import StockItem
from app.repositories import stock as stock_repository
from app.schemas.stock import OperationResult, ReceiptIn, StockItemOut, StockMoveOut


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
