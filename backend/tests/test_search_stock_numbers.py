from httpx import AsyncClient

from tests.test_search_stock import _receive


async def test_stock_by_numbers(client: AsyncClient) -> None:
    await _receive(client, "W 68/3", "MANN-FILTER")
    await _receive(client, "C170", "MANN-FILTER")
    await _receive(client, "X999", "MANN-FILTER")
    r = await client.get("/api/search/stock", params=[("numbers", "W683"), ("numbers", "C170")])
    assert r.status_code == 200
    items = r.json()
    assert sorted(i["number_norm"] for i in items) == ["C170", "W683"]
    assert all("sold_30d" in i and "last_receipt_at" in i for i in items)


async def test_stock_by_numbers_normalizes(client: AsyncClient) -> None:
    await _receive(client, "W683")
    r = await client.get("/api/search/stock", params=[("numbers", "w 68/3"), ("numbers", "W683")])
    assert [i["number_norm"] for i in r.json()] == ["W683"]


async def test_stock_by_numbers_empty(client: AsyncClient) -> None:
    r = await client.get("/api/search/stock")
    assert r.status_code == 200
    assert r.json() == []
    r = await client.get("/api/search/stock", params=[("numbers", " - ")])
    assert r.json() == []


async def test_stock_by_numbers_limit(client: AsyncClient) -> None:
    numbers = [("numbers", f"N{i}") for i in range(201)]
    r = await client.get("/api/search/stock", params=numbers)
    assert r.status_code == 422
    assert r.json()["message"] == "Слишком много номеров"


async def test_stock_by_numbers_requires_login(anon_client: AsyncClient) -> None:
    r = await anon_client.get("/api/search/stock", params={"numbers": "W683"})
    assert r.status_code == 401
