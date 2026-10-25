def valid_qty(qty: int, multiplicity: int, available: int) -> bool:
    return 1 <= qty <= available and qty % multiplicity == 0


def cap_qty(qty: int, multiplicity: int, available: int) -> int:
    capped = min(qty, available) // multiplicity * multiplicity
    return max(capped, 0)
