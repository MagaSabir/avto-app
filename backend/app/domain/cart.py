ORDER_MAX = 999  # max qty of an under-order line (no stock count); mirrored in the frontend


def valid_qty(qty: int, multiplicity: int, available: int) -> bool:
    return 1 <= qty <= available and qty % multiplicity == 0


def cap_qty(qty: int, multiplicity: int, available: int) -> int:
    capped = min(qty, available) // multiplicity * multiplicity
    return max(capped, 0)


def offer_available(kind: str, qty: int) -> int:
    return ORDER_MAX if kind == "order" else qty
