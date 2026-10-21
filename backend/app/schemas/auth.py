from pydantic import BaseModel, Field

from app.domain.auth import MAX_PASSWORD_LENGTH


class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class MeOut(BaseModel):
    login: str
