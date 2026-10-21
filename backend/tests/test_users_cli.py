from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.login_limiter import LoginLimiter
from app.services import auth
from app.services.errors import InvalidCredentials
from app.users import run_set_password

PASSWORD = "correct-horse-battery"


def _reader(*answers: str):
    it = iter(answers)
    return lambda _prompt: next(it)


@pytest.fixture
def session_factory(db_session: AsyncSession) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=db_session.bind,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )


async def _login(db_session: AsyncSession, login: str, password: str) -> str:
    return await auth.login(
        db_session, LoginLimiter(), "127.0.0.1", login, password, datetime.now(UTC)
    )


async def test_creates_user(
    db_session: AsyncSession, session_factory: async_sessionmaker[AsyncSession], capsys
) -> None:
    code = await run_set_password("Admin", _reader(PASSWORD, PASSWORD), session_factory)
    assert code == 0
    assert "Пользователь admin создан" in capsys.readouterr().out
    assert await _login(db_session, "admin", PASSWORD)


async def test_mismatch_returns_1(
    session_factory: async_sessionmaker[AsyncSession], capsys
) -> None:
    code = await run_set_password("admin", _reader(PASSWORD, "other-password-1"), session_factory)
    assert code == 1
    assert capsys.readouterr().err.strip()


async def test_short_password_returns_1(
    session_factory: async_sessionmaker[AsyncSession], capsys
) -> None:
    code = await run_set_password("admin", _reader("short", "short"), session_factory)
    assert code == 1
    assert capsys.readouterr().err.strip()


async def test_empty_login_returns_1(
    session_factory: async_sessionmaker[AsyncSession], capsys
) -> None:
    code = await run_set_password(" ", _reader(PASSWORD, PASSWORD), session_factory)
    assert code == 1
    assert "Введите логин" in capsys.readouterr().err


async def test_existing_user_password_changed(
    db_session: AsyncSession, session_factory: async_sessionmaker[AsyncSession], capsys
) -> None:
    await run_set_password("admin", _reader(PASSWORD, PASSWORD), session_factory)
    new = "another-long-password"
    code = await run_set_password("admin", _reader(new, new), session_factory)
    assert code == 0
    assert "Пароль admin изменён, все сессии завершены" in capsys.readouterr().out
    assert await _login(db_session, "admin", new)
    with pytest.raises(InvalidCredentials):
        await _login(db_session, "admin", PASSWORD)
