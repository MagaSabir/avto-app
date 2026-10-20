from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer


def _two_places(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


_two_place_json = PlainSerializer(_two_places, return_type=str, when_used="json")

Money = Annotated[Decimal, _two_place_json]
Percent = Annotated[Decimal, _two_place_json]
