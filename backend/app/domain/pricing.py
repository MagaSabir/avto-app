from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

_CENTS = Decimal("0.01")
_STEP = Decimal(10)


def sale_price(purchase: Decimal, markup: Decimal) -> Decimal:
    raw = purchase * (1 + markup / 100)
    rounded = (raw / _STEP).to_integral_value(rounding=ROUND_CEILING) * _STEP
    return rounded.quantize(_CENTS)


def markup_from_sale(purchase: Decimal, sale: Decimal) -> Decimal:
    return ((sale / purchase - 1) * 100).quantize(_CENTS, ROUND_HALF_UP)
