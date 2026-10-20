import httpx

from app.main import create_app
from app.services.errors import InsufficientStock


async def test_domain_error_handler() -> None:
    app = create_app()

    @app.get("/api/_boom")
    async def boom() -> None:
        raise InsufficientStock(2)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/_boom")
    assert r.status_code == 409
    assert r.json() == {"message": "Недостаточно на складе: остаток 2"}
    assert r.headers["cache-control"] == "no-store"
