import httpx
import pytest

from app.core.config import Settings
from app.main import create_app


def make_settings(**kwargs: object) -> Settings:
    return Settings(_env_file=None, database_url="x", **kwargs)  # type: ignore[call-arg]


def test_api_docs_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("API_DOCS", raising=False)
    assert make_settings().api_docs is False


@pytest.mark.parametrize("path", ["/openapi.json", "/docs", "/redoc"])
async def test_docs_hidden_when_disabled(monkeypatch: pytest.MonkeyPatch, path: str) -> None:
    monkeypatch.setattr("app.main.get_settings", lambda: make_settings(api_docs=False))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as ac:
        assert (await ac.get(path)).status_code == 404


async def test_openapi_served_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.get_settings", lambda: make_settings(api_docs=True))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as ac:
        assert (await ac.get("/openapi.json")).status_code == 200
