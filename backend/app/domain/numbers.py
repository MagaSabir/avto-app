import re

_SEPARATORS = re.compile(r"[\s\-./]")


def normalize_number(raw: str) -> str:
    code = raw.split("@", 1)[0]
    return _SEPARATORS.sub("", code.upper())


def normalize_brand(raw: str) -> str:
    return " ".join(raw.split()).upper()
