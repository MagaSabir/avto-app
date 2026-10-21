from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.db import get_session
from app.main import create_app
from app.models.auth import User

BACKEND_DIR = Path(__file__).resolve().parent.parent
UNAVAILABLE = (
    "Test database unavailable: start it with `docker compose -p avto_dev up -d db` "
    "and set TEST_DATABASE_URL in backend/.env"
)


def _test_database_url() -> str:
    url = get_settings().test_database_url
    if not url:
        pytest.exit(UNAVAILABLE, returncode=1)
    return url


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _test_database_url().replace("%", "%%"))
    try:
        command.upgrade(cfg, "head")
    except OSError:
        pytest.exit(UNAVAILABLE, returncode=1)


@pytest.fixture(scope="session")
async def test_engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(_test_database_url())
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except OSError:
        pytest.exit(UNAVAILABLE, returncode=1)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app()

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    async def override_current_user() -> User:
        return User(id=0, login="test")

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[current_user] = override_current_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def anon_client(db_session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app()

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as ac:
        yield ac
