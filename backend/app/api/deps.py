from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.domain.auth import SESSION_TTL
from app.models.auth import User
from app.services import auth as auth_service

SESSION_COOKIE = "session"


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, httponly=True, secure=True, samesite="lax", path="/")


async def current_user(
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    resolved = await auth_service.resolve(session, token, datetime.now(UTC))
    if resolved.renewed and token:
        set_session_cookie(response, token)
    return resolved.user


CurrentUser = Annotated[User, Depends(current_user)]
