from typing import Any

from httpx import AsyncClient

RECEIPT = {
    "number": "W 68/3",
    "brand": "MANN-FILTER",
    "name": "Oil filter",
    "qty": 10,
    "purchase_price": "400.00",
    "markup": "35",
    "sale_price": "540",
}


async def _post(client: AsyncClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    r = await client.post(url, json=body)
    assert r.status_code == 201, r.text
    data: dict[str, Any] = r.json()
    return data


async def _move(
    client: AsyncClient, item_id: int, op: str, customer_id: int, car_id: int | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"qty": 1, "price": "540", "payment": "cash", "customer_id": customer_id}
    if car_id is not None:
        body["car_id"] = car_id
    move: dict[str, Any] = (await _post(client, f"/api/stock/items/{item_id}/{op}", body))["move"]
    return move


async def _brief(client: AsyncClient, name: str) -> dict[str, Any]:
    r = await client.get("/api/customers", params={"q": name})
    assert r.status_code == 200
    found: list[dict[str, Any]] = [c for c in r.json() if c["name"] == name]
    assert len(found) == 1
    return found[0]


async def test_brief_has_last_purchase_and_its_car(client: AsyncClient) -> None:
    c = await _post(client, "/api/customers", {"name": "Иван Тест"})
    car_a = await _post(client, f"/api/customers/{c['id']}/cars", {"make": "Тест А"})
    car_b = await _post(client, f"/api/customers/{c['id']}/cars", {"make": "Тест Б"})
    item = (await _post(client, "/api/stock/receipts", RECEIPT))["item"]

    await _move(client, item["id"], "sales", c["id"], car_a["id"])
    await _move(client, item["id"], "sales", c["id"], car_b["id"])
    # Neither a later sale without a car, a return, nor a cancelled sale changes the car.
    no_car = await _move(client, item["id"], "sales", c["id"])
    await _move(client, item["id"], "returns", c["id"], car_a["id"])
    cancelled = await _move(client, item["id"], "sales", c["id"], car_a["id"])
    r = await client.post(f"/api/stock/moves/{cancelled['id']}/cancel", json={})
    assert r.status_code == 201

    brief = await _brief(client, "Иван Тест")
    assert brief["last_car_id"] == car_b["id"]
    assert brief["last_purchase_at"] == no_car["created_at"]


async def test_brief_without_purchases(client: AsyncClient) -> None:
    c = await _post(client, "/api/customers", {"name": "Пётр Тест"})
    await _post(client, f"/api/customers/{c['id']}/cars", {"make": "Тест"})
    brief = await _brief(client, "Пётр Тест")
    assert brief["last_purchase_at"] is None
    assert brief["last_car_id"] is None


async def test_count(client: AsyncClient) -> None:
    before = (await client.get("/api/customers/count")).json()["total"]
    await _post(client, "/api/customers", {"name": "Иван Тест"})
    await _post(client, "/api/customers", {"name": "Пётр Тест"})
    r = await client.get("/api/customers/count")
    assert r.status_code == 200
    assert r.json() == {"total": before + 2}


async def test_pages_with_offset(client: AsyncClient) -> None:
    for i in range(53):
        await _post(client, "/api/customers", {"name": f"Тест Страница {i:02d}"})
    first = (await client.get("/api/customers", params={"q": "Страница"})).json()
    second = (await client.get("/api/customers", params={"q": "Страница", "offset": 50})).json()
    assert len(first) == 50
    assert [c["name"] for c in second] == [f"Тест Страница {i:02d}" for i in (50, 51, 52)]
    assert not {c["id"] for c in first} & {c["id"] for c in second}
    r = await client.get("/api/customers", params={"offset": -1})
    assert r.status_code == 422


async def test_count_matches_query(client: AsyncClient) -> None:
    await _post(client, "/api/customers", {"name": "Иван Тест"})
    await _post(client, "/api/customers", {"name": "Пётр Тест"})
    r = await client.get("/api/customers/count", params={"q": "Иван"})
    assert r.json() == {"total": 1}
