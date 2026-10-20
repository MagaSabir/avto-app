import asyncio
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.models.stock import StockItem, StockMove
from app.schemas.stock import ReceiptIn, SaleIn
from app.services import stock as stock_service
from app.services.errors import InsufficientStock


async def test_concurrent_sales_last_unit(test_engine: AsyncEngine) -> None:
    number = "CONCURRENT-LAST-UNIT-1"
    s1 = AsyncSession(test_engine, expire_on_commit=False)
    s2 = AsyncSession(test_engine, expire_on_commit=False)
    cleanup = AsyncSession(test_engine, expire_on_commit=False)
    item_id: int | None = None
    try:
        created = await stock_service.receive(
            s1,
            ReceiptIn(
                number=number,
                brand="TESTBRAND",
                name="Concurrency",
                qty=1,
                purchase_price=Decimal("100.00"),
                markup=Decimal("30"),
                sale_price=Decimal("130.00"),
            ),
        )
        item_id = created.item.id
        sale = SaleIn(qty=1, price=Decimal("130.00"))
        results = await asyncio.gather(
            stock_service.sell(s1, item_id, sale),
            stock_service.sell(s2, item_id, sale),
            return_exceptions=True,
        )
        errors = [r for r in results if isinstance(r, InsufficientStock)]
        assert len(errors) == 1
        assert len([r for r in results if not isinstance(r, BaseException)]) == 1
        item = await cleanup.scalar(select(StockItem).where(StockItem.id == item_id))
        assert item is not None
        assert item.qty == 0
    finally:
        await s1.close()
        await s2.close()
        if item_id is not None:
            await cleanup.execute(delete(StockMove).where(StockMove.item_id == item_id))
            await cleanup.execute(delete(StockItem).where(StockItem.id == item_id))
            await cleanup.commit()
        await cleanup.close()
