from typing import Literal

from pydantic import BaseModel


class HealthOk(BaseModel):
    status: Literal["ok"] = "ok"


class HealthError(BaseModel):
    status: Literal["error"] = "error"
    message: str
