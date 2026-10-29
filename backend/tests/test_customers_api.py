from typing import Any

from httpx import AsyncClient, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

RECEIPT = {
    "number": "W 68/3",
    "brand": "MANN-FILTER",
    "name": "Oil filter",
    "qty": 10,
    "purchase_price": "400.00",
    "markup": "35",
    "sale_price": "540",
}


async def _delete(client: AsyncClient, url: str) -> Response:
    return await client.delete(url, headers={"Content-Type": "application/json"})


async def _customer(client: AsyncClient, **body: Any) -> dict[str, Any]:
    body.setdefault("name", "Иван Тест")
    r = await client.post("/api/customers", json=body)
    assert r.status_code == 201, r.text
    data: dict[str, Any] = r.json()
    return data


async def _car(client: AsyncClient, customer_id: int, **body: Any) -> dict[str, Any]:
    r = await client.post(f"/api/customers/{customer_id}/cars", json=body)
    assert r.status_code == 201, r.text
    data: dict[str, Any] = r.json()
    return data


async def test_create_normalizes_and_dedups_phones(client: AsyncClient) -> None:
    c = await _customer(
        client, name="  Иван Тест ", comment="  ", phones=["8 (900) 000-00-01", "+7 900 000-00-01"]
    )
    assert c["name"] == "Иван Тест"
    assert c["comment"] is None
    assert c["phones"] == ["79000000001"]
    assert c["cars"] == []
    assert c["warnings"] == []


async def test_bad_phone_and_blank_name(client: AsyncClient) -> None:
    r = await client.post("/api/customers", json={"name": "Иван Тест", "phones": ["12"]})
    assert r.status_code == 422
    assert r.json() == {"message": "Неверный телефон"}
    r = await client.post("/api/customers", json={"name": "  "})
    assert r.status_code == 422
    assert r.json() == {"message": "Введите имя"}


async def test_get_patch_delete(client: AsyncClient) -> None:
    c = await _customer(client, phones=["+7 900 000-00-01"])
    r = await client.get(f"/api/customers/{c['id']}")
    assert r.status_code == 200
    assert r.json()["phones"] == ["79000000001"]

    r = await client.patch(
        f"/api/customers/{c['id']}",
        json={"name": "Пётр Тест", "comment": "c", "phones": ["+7 900 000-00-02"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["name"], body["comment"], body["phones"]) == ("Пётр Тест", "c", ["79000000002"])

    r = await client.patch(f"/api/customers/{c['id']}", json={"comment": None})
    assert r.json()["comment"] is None
    assert r.json()["phones"] == ["79000000002"]

    r = await client.patch(f"/api/customers/{c['id']}", json={"bogus": 1})
    assert r.status_code == 422

    assert (await _delete(client, f"/api/customers/{c['id']}")).status_code == 204
    for r in (
        await client.get(f"/api/customers/{c['id']}"),
        await _delete(client, f"/api/customers/{c['id']}"),
        await client.patch(f"/api/customers/{c['id']}", json={"name": "x"}),
    ):
        assert r.status_code == 404
        assert r.json() == {"message": "Клиент не найден"}


async def test_cars(client: AsyncClient) -> None:
    c = await _customer(client)
    car = await _car(
        client, c["id"], make=" Тест ", model="М1", vin="xtt00000000000001", plate="a123bc 77"
    )
    assert car["make"] == "Тест"
    assert car["vin"] == "XTT00000000000001"
    assert car["plate"] == "А123ВС77"

    r = await client.patch(
        f"/api/customers/{c['id']}/cars/{car['id']}", json={"year": 2010, "make": None}
    )
    assert r.status_code == 200
    assert r.json()["year"] == 2010 and r.json()["make"] is None

    r = await client.patch(
        f"/api/customers/{c['id']}/cars/{car['id']}", json={"vin": None, "plate": None}
    )
    assert r.status_code == 422
    assert r.json() == {"message": "Укажите марку, VIN или госномер"}

    assert (await client.get(f"/api/customers/{c['id']}")).json()["cars"][0]["id"] == car["id"]
    assert (await _delete(client, f"/api/customers/{c['id']}/cars/{car['id']}")).status_code == 204
    r = await _delete(client, f"/api/customers/{c['id']}/cars/{car['id']}")
    assert r.status_code == 404
    assert r.json() == {"message": "Машина не найдена"}


async def test_car_validation(client: AsyncClient) -> None:
    c = await _customer(client)
    r = await client.post(f"/api/customers/{c['id']}/cars", json={"model": "М1"})
    assert r.status_code == 422
    assert r.json() == {"message": "Укажите марку, VIN или госномер"}
    r = await client.post(f"/api/customers/{c['id']}/cars", json={"vin": "BAD"})
    assert r.status_code == 422
    assert r.json() == {"message": "Неверный VIN"}
    r = await client.post("/api/customers/999999/cars", json={"make": "Тест"})
    assert r.json() == {"message": "Клиент не найден"}


async def test_car_of_other_customer_not_found(client: AsyncClient) -> None:
    a = await _customer(client)
    b = await _customer(client, name="Пётр Тест")
    car = await _car(client, a["id"], make="Тест")
    r = await _delete(client, f"/api/customers/{b['id']}/cars/{car['id']}")
    assert r.status_code == 404


async def test_duplicate_phone_warning(client: AsyncClient) -> None:
    await _customer(client, phones=["+7 916 123-45-67"])
    c = await _customer(client, name="Пётр Тест", phones=["89161234567"])
    assert c["warnings"] == ["Телефон +7 916 123-45-67 уже есть у клиента «Иван Тест»"]
    r = await client.patch(f"/api/customers/{c['id']}", json={"name": "Пётр Тест"})
    assert r.json()["warnings"] == []
    r = await client.patch(f"/api/customers/{c['id']}", json={"phones": ["89161234567"]})
    assert len(r.json()["warnings"]) == 1


async def _ids(client: AsyncClient, q: str) -> list[str]:
    r = await client.get("/api/customers", params={"q": q})
    assert r.status_code == 200
    return [c["name"] for c in r.json()]


async def test_search(client: AsyncClient) -> None:
    a = await _customer(client, name="Иван Тест", phones=["+7 900 123-40-01"])
    await _car(client, a["id"], make="Тест", plate="А777ВС77", vin="XTT00000000000001")
    await _customer(client, name="Пётр Пример", phones=["+7 916 555-00-02"])

    assert await _ids(client, "иван") == ["Иван Тест"]
    assert await _ids(client, "1234") == ["Иван Тест"]
    assert await _ids(client, "+7 916") == ["Пётр Пример"]
    assert await _ids(client, "a777bc") == ["Иван Тест"]
    assert await _ids(client, "xtt0000") == ["Иван Тест"]
    assert await _ids(client, "несуществует") == []
    r = await client.get("/api/customers", params={"q": "иван"})
    brief = r.json()[0]
    assert brief["phones"] == ["79001234001"]
    assert [{k: v for k, v in car.items() if k != "id"} for car in brief["cars"]] == [
        {"make": "Тест", "model": None, "plate": "А777ВС77"}
    ]


async def test_search_empty_q_orders_by_updated(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    a = await _customer(client, name="Аня Тест")
    b = await _customer(client, name="Борис Тест")
    # One test transaction means one now(); spread the timestamps explicitly.
    await db_session.execute(
        text("UPDATE customers SET updated_at = now() - interval '1 hour' WHERE id = :a"),
        {"a": a["id"]},
    )
    await db_session.execute(
        text("UPDATE customers SET updated_at = now() - interval '30 minutes' WHERE id = :b"),
        {"b": b["id"]},
    )
    assert await _ids(client, "") == ["Борис Тест", "Аня Тест"]
    await client.patch(f"/api/customers/{a['id']}", json={"phones": ["+7 900 000-00-03"]})
    assert await _ids(client, "") == ["Аня Тест", "Борис Тест"]


async def _linked_sale(
    client: AsyncClient, db_session: AsyncSession
) -> tuple[dict[str, Any], dict[str, Any], int]:
    c = await _customer(client)
    car = await _car(client, c["id"], make="Тест")
    item = (await client.post("/api/stock/receipts", json=RECEIPT)).json()["item"]
    r = await client.post(
        f"/api/stock/items/{item['id']}/sales",
        json={"qty": 1, "price": "540", "payment": "cash"},
    )
    move_id = r.json()["move"]["id"]
    await db_session.execute(
        text("UPDATE stock_moves SET customer_id=:c, car_id=:a WHERE id=:m"),
        {"c": c["id"], "a": car["id"], "m": move_id},
    )
    return c, car, move_id


async def _move(db_session: AsyncSession, move_id: int) -> Any:
    return (
        await db_session.execute(
            text("SELECT customer_id, car_id FROM stock_moves WHERE id=:m"), {"m": move_id}
        )
    ).one()


async def test_delete_customer_keeps_moves(client: AsyncClient, db_session: AsyncSession) -> None:
    c, _car_, move_id = await _linked_sale(client, db_session)
    assert (await _delete(client, f"/api/customers/{c['id']}")).status_code == 204
    assert tuple(await _move(db_session, move_id)) == (None, None)


async def test_delete_car_keeps_moves(client: AsyncClient, db_session: AsyncSession) -> None:
    c, car, move_id = await _linked_sale(client, db_session)
    assert (await _delete(client, f"/api/customers/{c['id']}/cars/{car['id']}")).status_code == 204
    assert tuple(await _move(db_session, move_id)) == (c["id"], None)


async def test_car_year_out_of_range(client: AsyncClient) -> None:
    c = await _customer(client)
    r = await client.post(f"/api/customers/{c['id']}/cars", json={"make": "Тест", "year": 1900})
    assert r.status_code == 422
    assert r.json() == {"message": "Неверный год"}
    car = await _car(client, c["id"], make="Тест", year=2010)
    r = await client.patch(f"/api/customers/{c['id']}/cars/{car['id']}", json={"year": 2101})
    assert r.status_code == 422
    assert r.json() == {"message": "Неверный год"}


async def test_car_changes_touch_customer(client: AsyncClient, db_session: AsyncSession) -> None:
    a = await _customer(client, name="Аня Тест")
    b = await _customer(client, name="Борис Тест")
    car = await _car(client, a["id"], make="Тест")

    async def reset() -> None:
        # One test transaction means one now(); spread the timestamps explicitly.
        for cid, minutes in ((a["id"], 60), (b["id"], 30)):
            await db_session.execute(
                text(
                    "UPDATE customers SET updated_at = now() - make_interval(mins => :m)"
                    " WHERE id = :i"
                ),
                {"m": minutes, "i": cid},
            )
        assert await _ids(client, "") == ["Борис Тест", "Аня Тест"]

    await reset()
    await _car(client, a["id"], make="Тест2")
    assert await _ids(client, "") == ["Аня Тест", "Борис Тест"]
    await reset()
    await client.patch(f"/api/customers/{a['id']}/cars/{car['id']}", json={"model": "М1"})
    assert await _ids(client, "") == ["Аня Тест", "Борис Тест"]
    await reset()
    await _delete(client, f"/api/customers/{a['id']}/cars/{car['id']}")
    assert await _ids(client, "") == ["Аня Тест", "Борис Тест"]
