from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.period import period_bounds
from app.repositories import cash as cash_repository
from app.schemas.cash import CashOperation, CashOut, CashTotals
from app.schemas.customers import CustomerRef
from app.services.errors import InvalidPeriod

ZERO = Decimal("0")


async def get_cash(session: AsyncSession, start: date, end: date, tz: ZoneInfo) -> CashOut:
    bounds = period_bounds(start, end, tz)
    if bounds is None:
        raise InvalidPeriod()
    rows = await cash_repository.period_moves(session, *bounds)

    sales = returns = cash = transfer = profit = writeoffs = ZERO
    no_cost = no_payment = writeoffs_no_cost = 0
    operations: list[CashOperation] = []
    for move, item, login, customer in rows:
        qty = abs(move.qty_delta)
        if move.type == "writeoff":
            if move.cost is None:
                writeoffs_no_cost += 1
            else:
                writeoffs += move.cost * qty
            continue
        if move.type not in ("sale", "return") or move.price is None:
            continue
        # A sale brings money in, a return gives it back.
        sign = -1 if move.qty_delta > 0 else 1
        amount = move.price * qty
        if move.type == "sale":
            sales += amount
        else:
            returns += amount
        if move.payment == "cash":
            cash += sign * amount
        elif move.payment == "transfer":
            transfer += sign * amount
        else:
            no_payment += 1
        op_profit = None
        if move.cost is None:
            no_cost += 1
        else:
            # Adding zero turns Decimal("-0.00") into "0.00".
            op_profit = (move.price - move.cost) * -move.qty_delta + ZERO
            profit += op_profit
        operations.append(
            CashOperation(
                move_id=move.id,
                type=move.type,
                created_at=move.created_at,
                item_id=item.id,
                number_raw=item.number_raw,
                brand=item.brand,
                name=item.name,
                qty=qty,
                price=move.price,
                amount=amount,
                payment=move.payment,
                cost=move.cost,
                profit=op_profit,
                user=login,
                customer=CustomerRef(id=customer.id, name=customer.name) if customer else None,
            )
        )

    return CashOut(
        totals=CashTotals(
            sales=sales,
            returns=returns,
            revenue=sales - returns,
            cash=cash,
            transfer=transfer,
            profit=profit,
            no_cost_count=no_cost,
            no_payment_count=no_payment,
            writeoffs=writeoffs,
            writeoffs_no_cost_count=writeoffs_no_cost,
            profit_after_writeoffs=profit - writeoffs,
        ),
        operations=operations,
    )
