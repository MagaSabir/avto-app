import re

from app.domain.numbers import normalize_brand

_AROUND_SYMBOLS = re.compile(r"\s*([&\-/])\s*")

BRAND_SYNONYMS = {"MANN-FILTER": "MANN"}


def canonical_brand(brand: str) -> str:
    value = _AROUND_SYMBOLS.sub(r"\1", normalize_brand(brand))
    return BRAND_SYNONYMS.get(value, value)


def part_key(brand: str, number_norm: str) -> str:
    return f"{canonical_brand(brand)}|{number_norm}"
