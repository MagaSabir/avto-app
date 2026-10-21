from functools import lru_cache
from typing import Annotated, Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    test_database_url: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = []
    suppliers: Annotated[list[str], NoDecode] = ["rossko"]
    rossko_key1: str = Field(default="", repr=False)
    rossko_key2: str = Field(default="", repr=False)
    rossko_delivery_id: str = "000000002"
    rossko_address_id: str = "171801"

    @field_validator("suppliers", mode="before")
    @classmethod
    def parse_suppliers(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = [code.strip() for code in value.split(",")]
        if isinstance(value, list):
            value = [code for code in value if code]
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = [origin.strip().rstrip("/") for origin in value.split(",")]
        if isinstance(value, list):
            value = [origin for origin in value if origin]
            if "*" in value:
                raise ValueError("CORS_ORIGINS must list explicit origins, '*' is not allowed")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
