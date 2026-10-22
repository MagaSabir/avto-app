from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AuthSession
from app.services import auth

PASSWORD = "correct-password-1"


async def _make_user(db_session: AsyncSession, login: str = "admin") -> None:
    await auth.set_password(db_session, login, PASSWORD)


async def _login(anon_client: httpx.AsyncClient, password: str = PASSWORD) -> httpx.Response:
    return await anon_client.post("/api/auth/login", json={"login": "admin", "password": password})


async def test_login_sets_cookie(anon_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session)
    response = await _login(anon_client)
    assert response.status_code == 204
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=2592000" in cookie
    assert "Path=/" in cookie
    assert "domain" not in cookie.lower()


async def test_login_wrong_password_401(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    response = await _login(anon_client, "wrong-password")
    assert response.status_code == 401
    assert response.json() == {"message": "Неверный логин или пароль"}


async def test_login_empty_fields_422(anon_client: httpx.AsyncClient) -> None:
    response = await anon_client.post("/api/auth/login", json={"login": "", "password": ""})
    assert response.status_code == 422


async def test_login_rate_limited_429(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    for _ in range(10):
        assert (await _login(anon_client, "wrong-password")).status_code == 401
    response = await _login(anon_client, "wrong-password")
    assert response.status_code == 429
    assert response.json() == {"message": "Слишком много попыток входа, подождите несколько минут"}


async def test_me_after_login(anon_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    response = await anon_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() == {"login": "admin", "first_name": "", "last_name": ""}


async def test_me_without_cookie_401(anon_client: httpx.AsyncClient) -> None:
    response = await anon_client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"message": "Требуется вход"}


async def test_logout_then_me_401(anon_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    response = await anon_client.post("/api/auth/logout", json={})
    assert response.status_code == 204
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert (await anon_client.get("/api/auth/me")).status_code == 401


async def test_logout_without_session_204(anon_client: httpx.AsyncClient) -> None:
    response = await anon_client.post("/api/auth/logout", json={})
    assert response.status_code == 204


async def test_renewed_session_resets_cookie(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    await db_session.execute(
        update(AuthSession).values(expires_at=datetime.now(UTC) + timedelta(days=10))
    )
    await db_session.commit()
    response = await anon_client.get("/api/auth/me")
    assert response.status_code == 200
    assert "Max-Age=2592000" in response.headers["set-cookie"]


async def test_changed_password_invalidates_cookie(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    await auth.set_password(db_session, "admin", "another-password-2")
    assert (await anon_client.get("/api/auth/me")).status_code == 401


async def test_cors_allows_credentials_for_local_frontend(anon_client: httpx.AsyncClient) -> None:
    ok = await anon_client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers["access-control-allow-credentials"] == "true"
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    evil = await anon_client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers


async def test_update_names(anon_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    response = await anon_client.patch(
        "/api/auth/me", json={"first_name": " Сабир ", "last_name": "Магомедов"}
    )
    assert response.status_code == 200
    assert response.json() == {"login": "admin", "first_name": "Сабир", "last_name": "Магомедов"}
    again = await anon_client.get("/api/auth/me")
    assert again.json()["first_name"] == "Сабир"


async def test_update_names_can_clear(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    await anon_client.patch("/api/auth/me", json={"first_name": "A", "last_name": "B"})
    response = await anon_client.patch("/api/auth/me", json={"first_name": "  ", "last_name": ""})
    assert response.json() == {"login": "admin", "first_name": "", "last_name": ""}


async def test_update_names_too_long_422(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    response = await anon_client.patch(
        "/api/auth/me", json={"first_name": "я" * 101, "last_name": ""}
    )
    assert response.status_code == 422


async def test_update_names_without_login_401(anon_client: httpx.AsyncClient) -> None:
    response = await anon_client.patch("/api/auth/me", json={"first_name": "A", "last_name": "B"})
    assert response.status_code == 401


async def test_update_names_requires_json_415(
    anon_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session)
    await _login(anon_client)
    response = await anon_client.patch(
        "/api/auth/me", content="first_name=A", headers={"Content-Type": "text/plain"}
    )
    assert response.status_code == 415
