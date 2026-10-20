from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


def _two_places(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


Markup = Annotated[Decimal, PlainSerializer(_two_places, return_type=str, when_used="json")]


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    default_markup: Markup


class SettingsPatch(BaseModel):
    default_markup: Decimal = Field(ge=0, le=1000, decimal_places=2)
