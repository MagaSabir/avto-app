from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

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
SALE = {"qty": 1, "price": "540", "payment": "cash"}


async def _item(client: AsyncClient) -> dict[str, Any]:
    r = await client.post("/api/stock/receipts", json=RECEIPT)
    assert r.status_code == 201
    item: dict[str, Any] = r.json()["item"]
    return item


async def _customer(client: AsyncClient, name: str = "Иван Тест") -> dict[str, Any]:
    r = await client.post("/api/customers", json={"name": name})
    assert r.status_code == 201
    data: dict[str, Any] = r.json()
    return data


async def _car(client: AsyncClient, customer_id: int, plate: str = "А001АА77") -> dict[str, Any]:
    r = await client.post(
        f"/api/customers/{customer_id}/cars", json={"make": "Lada", "plate": plate}
    )
    assert r.status_code == 201
    data: dict[str, Any] = r.json()
    return data


async def _post(client: AsyncClient, item: dict[str, Any], op: str, body: dict[str, Any]) -> Any:
    return await client.post(f"/api/stock/items/{item['id']}/{op}", json=body)


async def _qty(client: AsyncClient, item: dict[str, Any]) -> int:
    r = await client.get(f"/api/stock/items/{item['id']}")
    qty: int = r.json()["qty"]
    return qty


async def test_sale_with_customer_and_car(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    car = await _car(client, c["id"])
    r = await _post(client, item, "sales", SALE | {"customer_id": c["id"], "car_id": car["id"]})
    assert r.status_code == 201
    move = r.json()["move"]
    assert move["customer"] == {"id": c["id"], "name": "Иван Тест"}
    assert move["car"]["plate"] == car["plate"]
    r = await client.get(f"/api/stock/items/{item['id']}/moves")
    assert r.json()[0]["customer"]["name"] == "Иван Тест"
    assert r.json()[0]["car"]["id"] == car["id"]


async def test_sale_without_customer(client: AsyncClient) -> None:
    item = await _item(client)
    r = await _post(client, item, "sales", SALE)
    assert r.json()["move"]["customer"] is None
    assert r.json()["move"]["car"] is None


async def test_return_with_customer_and_car(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    car = await _car(client, c["id"])
    r = await _post(client, item, "returns", SALE | {"customer_id": c["id"], "car_id": car["id"]})
    assert r.status_code == 201
    assert r.json()["move"]["customer"]["name"] == "Иван Тест"
    assert r.json()["move"]["car"]["plate"] == car["plate"]


async def test_car_of_another_customer(client: AsyncClient) -> None:
    item = await _item(client)
    a = await _customer(client)
    b = await _customer(client, "Пётр Тест")
    car = await _car(client, b["id"])
    r = await _post(client, item, "sales", SALE | {"customer_id": a["id"], "car_id": car["id"]})
    assert r.status_code == 422
    assert r.json()["message"] == "Машина не принадлежит клиенту"
    assert await _qty(client, item) == 10


async def test_unknown_customer(client: AsyncClient) -> None:
    item = await _item(client)
    r = await _post(client, item, "sales", SALE | {"customer_id": 999999})
    assert r.status_code == 422
    assert r.json()["message"] == "Клиент не найден"
    assert await _qty(client, item) == 10


async def test_car_without_customer(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    car = await _car(client, c["id"])
    r = await _post(client, item, "sales", SALE | {"car_id": car["id"]})
    assert r.status_code == 422
    assert r.json()["message"] == "Машина не принадлежит клиенту"
    assert await _qty(client, item) == 10


async def test_cancel_sale_with_customer(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    car = await _car(client, c["id"])
    sale = (
        await _post(client, item, "sales", SALE | {"customer_id": c["id"], "car_id": car["id"]})
    ).json()["move"]
    r = await client.post(f"/api/stock/moves/{sale['id']}/cancel", json={})
    assert r.status_code == 201
    assert r.json()["move"]["customer"] is None


async def test_history(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    car1 = await _car(client, c["id"])
    car2 = await _car(client, c["id"], "В002ВВ77")
    other = await _customer(client, "Пётр Тест")
    await _post(client, item, "sales", SALE | {"customer_id": other["id"]})
    sale = (
        await _post(client, item, "sales", SALE | {"customer_id": c["id"], "car_id": car1["id"]})
    ).json()["move"]
    ret = (
        await _post(client, item, "returns", SALE | {"customer_id": c["id"], "car_id": car2["id"]})
    ).json()["move"]
    cancelled = (await _post(client, item, "sales", SALE | {"customer_id": c["id"]})).json()["move"]
    await client.post(f"/api/stock/moves/{cancelled['id']}/cancel", json={})

    r = await client.get(f"/api/customers/{c['id']}/history")
    assert r.status_code == 200
    rows = r.json()
    assert [row["move_id"] for row in rows] == [ret["id"], sale["id"]]
    assert rows[0]["type"] == "return"
    assert rows[1]["number_raw"] == "W 68/3"
    assert rows[1]["amount"] == "540.00"
    assert rows[1]["car"]["plate"] == car1["plate"]

    r = await client.get(f"/api/customers/{c['id']}/history", params={"car_id": car1["id"]})
    assert [row["move_id"] for row in r.json()] == [sale["id"]]


async def test_history_unknown_customer(client: AsyncClient) -> None:
    r = await client.get("/api/customers/999999/history")
    assert r.status_code == 404


async def test_cash_operation_has_customer(client: AsyncClient) -> None:
    item = await _item(client)
    c = await _customer(client)
    await _post(client, item, "sales", SALE | {"customer_id": c["id"]})
    await _post(client, item, "sales", SALE)
    day = datetime.now(UTC).astimezone(ZoneInfo("Europe/Moscow")).date().isoformat()
    r = await client.get("/api/cash", params={"start": day, "end": day})
    ops = r.json()["operations"]
    assert ops[1]["customer"] == {"id": c["id"], "name": "Иван Тест"}
    assert ops[0]["customer"] is None
