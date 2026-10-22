from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.domain.auth import MAX_PASSWORD_LENGTH


class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class MeOut(BaseModel):
    login: str
    first_name: str
    last_name: str


class MeIn(BaseModel):
    first_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
    last_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
