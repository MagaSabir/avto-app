from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import get_settings
from app.main import create_app

JSON_ONLY_DETAIL = {"detail": "Content-Type must be application/json"}
LOCAL_ORIGIN = "http://localhost:5173"


def preflight_headers(origin: str) -> dict[str, str]:
    return {"Origin": origin, "Access-Control-Request-Method": "GET"}


async def test_no_store_on_ok(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.headers["cache-control"] == "no-store"


async def test_no_store_on_404(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/nope")
    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"


async def test_no_store_on_415(client: httpx.AsyncClient) -> None:
    response = await client.post("/api/health", content="x", headers={"Content-Type": "text/plain"})
    assert response.status_code == 415
    assert response.headers["cache-control"] == "no-store"


async def test_post_without_content_type_is_415(client: httpx.AsyncClient) -> None:
    response = await client.post("/api/health")
    assert response.status_code == 415
    assert response.json() == JSON_ONLY_DETAIL


async def test_post_text_plain_is_415(client: httpx.AsyncClient) -> None:
    response = await client.post("/api/health", content="x", headers={"Content-Type": "text/plain"})
    assert response.status_code == 415
    assert response.json() == JSON_ONLY_DETAIL


async def test_delete_without_content_type_is_415(client: httpx.AsyncClient) -> None:
    response = await client.delete("/api/health")
    assert response.status_code == 415
    assert response.json() == JSON_ONLY_DETAIL


async def test_post_json_with_charset_passes(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/health", content="{}", headers={"Content-Type": "application/json; charset=utf-8"}
    )
    assert response.status_code == 405


async def test_post_json_uppercase_passes(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/health", content="{}", headers={"Content-Type": "Application/JSON"}
    )
    assert response.status_code == 405


async def test_cors_preflight_localhost_allowed(client: httpx.AsyncClient) -> None:
    response = await client.options("/api/health", headers=preflight_headers(LOCAL_ORIGIN))
    assert response.headers["access-control-allow-origin"] == LOCAL_ORIGIN


@pytest.fixture
async def configured_client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setenv("CORS_ORIGINS", "https://avto.vercel.app")
    get_settings.cache_clear()
    app = create_app()
    get_settings.cache_clear()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_cors_preflight_configured_origin_allowed(
    configured_client: httpx.AsyncClient,
) -> None:
    response = await configured_client.options(
        "/api/health", headers=preflight_headers("https://avto.vercel.app")
    )
    assert response.headers["access-control-allow-origin"] == "https://avto.vercel.app"


async def test_cors_preflight_foreign_origin_denied(client: httpx.AsyncClient) -> None:
    response = await client.options(
        "/api/health", headers=preflight_headers("https://evil.example")
    )
    assert "access-control-allow-origin" not in response.headers


async def test_415_has_cors_header(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/health", content="x", headers={"Content-Type": "text/plain", "Origin": LOCAL_ORIGIN}
    )
    assert response.status_code == 415
    assert response.headers["access-control-allow-origin"] == LOCAL_ORIGIN
