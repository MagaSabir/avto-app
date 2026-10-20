from collections.abc import AsyncIterator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.db import get_session
from app.main import create_app


async def test_health_ok(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_503_when_database_unreachable() -> None:
    engine = create_async_engine("postgresql+asyncpg://avto:avto@127.0.0.1:1/avto")
    app = create_app()

    async def unreachable_session() -> AsyncIterator[AsyncSession]:
        async with AsyncSession(engine) as session:
            yield session

    app.dependency_overrides[get_session] = unreachable_session
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/health")
    finally:
        await engine.dispose()
    assert response.status_code == 503
    assert response.json() == {"status": "error", "message": "Database unavailable"}
