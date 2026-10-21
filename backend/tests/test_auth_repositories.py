from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import sessions, users

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)


async def test_get_active_returns_session_and_user(db_session: AsyncSession) -> None:
    user = await users.add(db_session, "alice", "hash")
    await sessions.add(db_session, user.id, "t" * 64, NOW + timedelta(days=1))

    found = await sessions.get_active(db_session, "t" * 64, NOW)

    assert found is not None
    auth_session, found_user = found
    assert auth_session.token_hash == "t" * 64
    assert found_user.id == user.id
    assert found_user.login == "alice"


async def test_get_active_ignores_expired(db_session: AsyncSession) -> None:
    user = await users.add(db_session, "alice", "hash")
    await sessions.add(db_session, user.id, "t" * 64, NOW - timedelta(seconds=1))

    assert await sessions.get_active(db_session, "t" * 64, NOW) is None


async def test_delete_expired_keeps_active(db_session: AsyncSession) -> None:
    user = await users.add(db_session, "alice", "hash")
    await sessions.add(db_session, user.id, "a" * 64, NOW - timedelta(hours=1))
    await sessions.add(db_session, user.id, "b" * 64, NOW + timedelta(hours=1))

    await sessions.delete_expired(db_session, NOW)

    assert await sessions.get_active(db_session, "a" * 64, NOW - timedelta(hours=2)) is None
    assert await sessions.get_active(db_session, "b" * 64, NOW) is not None


async def test_delete_by_token_hash(db_session: AsyncSession) -> None:
    user = await users.add(db_session, "alice", "hash")
    await sessions.add(db_session, user.id, "a" * 64, NOW + timedelta(hours=1))

    await sessions.delete_by_token_hash(db_session, "a" * 64)

    assert await sessions.get_active(db_session, "a" * 64, NOW) is None


async def test_delete_for_user(db_session: AsyncSession) -> None:
    alice = await users.add(db_session, "alice", "hash")
    bob = await users.add(db_session, "bob", "hash")
    await sessions.add(db_session, alice.id, "a" * 64, NOW + timedelta(hours=1))
    await sessions.add(db_session, bob.id, "b" * 64, NOW + timedelta(hours=1))

    await sessions.delete_for_user(db_session, alice.id)

    assert await sessions.get_active(db_session, "a" * 64, NOW) is None
    assert await sessions.get_active(db_session, "b" * 64, NOW) is not None


async def test_get_by_login(db_session: AsyncSession) -> None:
    user = await users.add(db_session, "alice", "hash")

    assert (await users.get_by_login(db_session, "alice")) is user
    assert await users.get_by_login(db_session, "nobody") is None


async def test_login_unique(db_session: AsyncSession) -> None:
    await users.add(db_session, "alice", "hash")

    with pytest.raises(IntegrityError):
        await users.add(db_session, "alice", "other")
