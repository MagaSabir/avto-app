from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.types import Percent


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    default_markup: Percent


class SettingsPatch(BaseModel):
    default_markup: Decimal = Field(ge=0, le=1000, decimal_places=2)
