import httpx
from sqlalchemy.exc import IntegrityError

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


async def test_integrity_error_handler() -> None:
    app = create_app()

    @app.get("/api/_conflict")
    async def conflict() -> None:
        raise IntegrityError("INSERT ...", {}, Exception("duplicate key"))

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/_conflict", headers={"Origin": "http://localhost:5173"})
    assert r.status_code == 409
    assert r.json() == {"message": "Конфликт данных: обновите страницу и повторите"}
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert r.headers["cache-control"] == "no-store"
