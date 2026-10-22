import asyncio
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.login_limiter import LoginLimiter
from app.core.security import (
    hash_password,
    new_session_token,
    password_needs_rehash,
    verify_dummy_password,
    verify_password,
)
from app.domain.auth import SESSION_TTL, hash_token, needs_renewal, normalize_login
from app.models.auth import User
from app.repositories import sessions as sessions_repo
from app.repositories import users as users_repo
from app.services.errors import InvalidCredentials, NotAuthenticated, TooManyLoginAttempts


@dataclass
class ResolvedSession:
    user: User
    renewed: bool


async def login(
    session: AsyncSession,
    limiter: LoginLimiter,
    ip: str,
    login: str,
    password: str,
    now: datetime,
) -> str:
    # The attempt is recorded before any await so parallel requests cannot all pass the check.
    if not limiter.try_acquire(ip):
        raise TooManyLoginAttempts()
    user = await users_repo.get_by_login(session, normalize_login(login))
    if user is None:
        await asyncio.to_thread(verify_dummy_password, password)
        raise InvalidCredentials()
    if not await asyncio.to_thread(verify_password, user.password_hash, password):
        raise InvalidCredentials()
    limiter.forgive(ip)
    if password_needs_rehash(user.password_hash):
        user.password_hash = await asyncio.to_thread(hash_password, password)
    await sessions_repo.delete_expired(session, now)
    token = new_session_token()
    await sessions_repo.add(session, user.id, hash_token(token), now + SESSION_TTL)
    await session.commit()
    return token


async def resolve(session: AsyncSession, token: str | None, now: datetime) -> ResolvedSession:
    if not token:
        raise NotAuthenticated()
    found = await sessions_repo.get_active(session, hash_token(token), now)
    if found is None:
        raise NotAuthenticated()
    auth_session, user = found
    renewed = needs_renewal(auth_session.expires_at, now)
    if renewed:
        auth_session.expires_at = now + SESSION_TTL
        await session.commit()
    return ResolvedSession(user=user, renewed=renewed)


async def logout(session: AsyncSession, token: str | None) -> None:
    if not token:
        return
    await sessions_repo.delete_by_token_hash(session, hash_token(token))
    await session.commit()


async def set_password(session: AsyncSession, login: str, password: str) -> bool:
    """Create the user, or change the password and drop all their sessions."""
    name = normalize_login(login)
    user = await users_repo.get_by_login(session, name)
    created = user is None
    if user is None:
        await users_repo.add(session, name, await asyncio.to_thread(hash_password, password))
    else:
        user.password_hash = await asyncio.to_thread(hash_password, password)
        await sessions_repo.delete_for_user(session, user.id)
    await session.commit()
    return created


async def update_names(session: AsyncSession, user: User, first_name: str, last_name: str) -> User:
    await users_repo.set_names(session, user, first_name, last_name)
    await session.commit()
    return user
