from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.login_limiter import LoginLimiter
from app.core.security import hash_password, verify_password
from app.domain.auth import SESSION_TTL, hash_token
from app.repositories import sessions as sessions_repo
from app.repositories import users as users_repo
from app.services import auth
from app.services.errors import InvalidCredentials, NotAuthenticated, TooManyLoginAttempts

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
PASSWORD = "correct-horse-battery"


async def make_user(session: AsyncSession, login: str = "admin") -> int:
    user = await users_repo.add(session, login, hash_password(PASSWORD))
    return user.id


async def test_login_returns_token_and_creates_session(db_session: AsyncSession) -> None:
    await make_user(db_session)
    token = await auth.login(db_session, LoginLimiter(), "1.1.1.1", "admin", PASSWORD, NOW)
    found = await sessions_repo.get_active(db_session, hash_token(token), NOW)
    assert found is not None
    assert found[0].expires_at == NOW + SESSION_TTL


async def test_login_normalizes_login(db_session: AsyncSession) -> None:
    await make_user(db_session)
    token = await auth.login(db_session, LoginLimiter(), "1.1.1.1", "  Admin ", PASSWORD, NOW)
    assert token


async def test_login_wrong_password(db_session: AsyncSession) -> None:
    await make_user(db_session)
    limiter = LoginLimiter(max_failures=1)
    with pytest.raises(InvalidCredentials):
        await auth.login(db_session, limiter, "1.1.1.1", "admin", "wrong", NOW)
    assert limiter.is_blocked("1.1.1.1")


async def test_login_unknown_user(db_session: AsyncSession) -> None:
    limiter = LoginLimiter(max_failures=1)
    with pytest.raises(InvalidCredentials):
        await auth.login(db_session, limiter, "1.1.1.1", "nobody", PASSWORD, NOW)
    assert limiter.is_blocked("1.1.1.1")


async def test_login_blocked_skips_password_check(db_session: AsyncSession) -> None:
    await make_user(db_session)
    limiter = LoginLimiter()
    for _ in range(10):
        with pytest.raises(InvalidCredentials):
            await auth.login(db_session, limiter, "1.1.1.1", "admin", "wrong", NOW)
    with pytest.raises(TooManyLoginAttempts):
        await auth.login(db_session, limiter, "1.1.1.1", "admin", PASSWORD, NOW)


async def test_login_deletes_expired_sessions(db_session: AsyncSession) -> None:
    user_id = await make_user(db_session)
    await sessions_repo.add(db_session, user_id, hash_token("old"), NOW - timedelta(days=1))
    await auth.login(db_session, LoginLimiter(), "1.1.1.1", "admin", PASSWORD, NOW)
    assert (
        await sessions_repo.get_active(db_session, hash_token("old"), NOW - timedelta(days=2))
        is None
    )


async def test_resolve_renews_old_session(db_session: AsyncSession) -> None:
    user_id = await make_user(db_session)
    await sessions_repo.add(db_session, user_id, hash_token("t"), NOW + timedelta(days=10))
    resolved = await auth.resolve(db_session, "t", NOW)
    assert resolved.renewed
    assert resolved.user.id == user_id
    found = await sessions_repo.get_active(db_session, hash_token("t"), NOW)
    assert found is not None
    assert found[0].expires_at == NOW + SESSION_TTL


async def test_resolve_fresh_session_not_renewed(db_session: AsyncSession) -> None:
    user_id = await make_user(db_session)
    await sessions_repo.add(db_session, user_id, hash_token("t"), NOW + SESSION_TTL)
    resolved = await auth.resolve(db_session, "t", NOW)
    assert not resolved.renewed


async def test_resolve_expired_raises(db_session: AsyncSession) -> None:
    user_id = await make_user(db_session)
    await sessions_repo.add(db_session, user_id, hash_token("t"), NOW - timedelta(seconds=1))
    with pytest.raises(NotAuthenticated):
        await auth.resolve(db_session, "t", NOW)
    with pytest.raises(NotAuthenticated):
        await auth.resolve(db_session, None, NOW)


async def test_logout_deletes_session(db_session: AsyncSession) -> None:
    user_id = await make_user(db_session)
    await sessions_repo.add(db_session, user_id, hash_token("t"), NOW + SESSION_TTL)
    await auth.logout(db_session, "t")
    assert await sessions_repo.get_active(db_session, hash_token("t"), NOW) is None
    await auth.logout(db_session, None)


async def test_set_password_creates_then_changes_and_drops_sessions(
    db_session: AsyncSession,
) -> None:
    assert await auth.set_password(db_session, " Boss ", "first-password-1")
    user = await users_repo.get_by_login(db_session, "boss")
    assert user is not None
    await sessions_repo.add(db_session, user.id, hash_token("t"), NOW + SESSION_TTL)

    assert not await auth.set_password(db_session, "boss", "second-password-2")
    await db_session.refresh(user)
    assert verify_password(user.password_hash, "second-password-2")
    assert await sessions_repo.get_active(db_session, hash_token("t"), NOW) is None
