from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SESSION_COOKIE, CurrentUser, clear_session_cookie, set_session_cookie
from app.core.db import get_session
from app.models.auth import User
from app.schemas.auth import LoginIn, MeIn, MeOut
from app.schemas.errors import ErrorOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    status_code=204,
    responses={401: {"model": ErrorOut}, 429: {"model": ErrorOut}},
)
async def login(
    body: LoginIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    ip = request.client.host if request.client else "unknown"
    token = await auth_service.login(
        session, request.app.state.login_limiter, ip, body.login, body.password, datetime.now(UTC)
    )
    response = Response(status_code=204)
    set_session_cookie(response, token)
    return response


@router.post("/logout", status_code=204)
async def logout(
    request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    await auth_service.logout(session, request.cookies.get(SESSION_COOKIE))
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response


@router.get("/me", response_model=MeOut, responses={401: {"model": ErrorOut}})
async def me(user: CurrentUser) -> MeOut:
    return _me(user)


@router.patch(
    "/me", response_model=MeOut, responses={401: {"model": ErrorOut}, 422: {"model": ErrorOut}}
)
async def update_me(
    body: MeIn, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> MeOut:
    updated = await auth_service.update_names(session, user, body.first_name, body.last_name)
    return _me(updated)


def _me(user: User) -> MeOut:
    return MeOut(login=user.login, first_name=user.first_name, last_name=user.last_name)
