import re

_VIN = re.compile(r"[A-HJ-NPR-Z0-9]{17}")
_LATIN_TO_CYRILLIC = str.maketrans("ABEKMHOPCTYX", "АВЕКМНОРСТУХ")


def normalize_phone(raw: str) -> str | None:
    digits = "".join(ch for ch in raw if ch.isascii() and ch.isdigit())
    if len(digits) < 5:
        return None
    if len(digits) == 11 and digits[0] == "8":
        return "7" + digits[1:]
    if len(digits) == 10:
        return "7" + digits
    return digits


def normalize_plate(raw: str) -> str | None:
    plate = "".join(raw.upper().split()).replace("-", "").translate(_LATIN_TO_CYRILLIC)
    return plate or None


def normalize_vin(raw: str) -> str | None:
    vin = "".join(raw.upper().split())
    if not vin:
        return None
    if not _VIN.fullmatch(vin):
        raise ValueError("Неверный VIN")
    return vin
