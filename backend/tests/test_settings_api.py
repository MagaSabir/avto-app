from httpx import AsyncClient


async def test_get_settings(client: AsyncClient) -> None:
    r = await client.get("/api/settings")
    assert r.status_code == 200
    assert r.json() == {"default_markup": "30.00"}


async def test_patch_settings(client: AsyncClient) -> None:
    r = await client.patch("/api/settings", json={"default_markup": "25"})
    assert r.status_code == 200
    assert r.json() == {"default_markup": "25.00"}
    r = await client.get("/api/settings")
    assert r.json() == {"default_markup": "25.00"}


async def test_patch_negative_rejected(client: AsyncClient) -> None:
    r = await client.patch("/api/settings", json={"default_markup": "-1"})
    assert r.status_code == 422


async def test_patch_requires_json(client: AsyncClient) -> None:
    r = await client.patch(
        "/api/settings", content='{"default_markup": "25"}', headers={"Content-Type": "text/plain"}
    )
    assert r.status_code == 415
