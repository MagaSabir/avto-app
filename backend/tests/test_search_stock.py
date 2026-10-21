from typing import Any

from httpx import AsyncClient


async def _receive(
    client: AsyncClient,
    number: str,
    brand: str = "MANN-FILTER",
    qty: int = 3,
    supplier: str | None = None,
) -> dict[str, Any]:
    r = await client.post(
        "/api/stock/receipts",
        json={
            "number": number,
            "brand": brand,
            "name": "Масляный фильтр",
            "qty": qty,
            "purchase_price": "412.00",
            "markup": "30",
            "sale_price": "540",
            "supplier": supplier,
        },
    )
    assert r.status_code == 201
    item: dict[str, Any] = r.json()["item"]
    return item


async def test_search_finds_by_normalized_number_any_brand(client: AsyncClient) -> None:
    await _receive(client, "W 68/3", "MANN-FILTER")
    await _receive(client, "W68/3", "MGA")
    await _receive(client, "W68/4", "MANN-FILTER")
    r = await client.get("/api/search", params={"q": "w 68-3"})
    assert r.status_code == 200
    data = r.json()
    assert data["query"] == "w 68-3"
    assert data["number_norm"] == "W683"
    assert [i["brand"] for i in data["items"]] == ["MANN-FILTER", "MGA"]


async def test_search_strips_supplier_code(client: AsyncClient) -> None:
    await _receive(client, "BKR5EKB-11", "NGK")
    r = await client.get("/api/search", params={"q": "BKR5EKB-11@7804"})
    assert [i["number_norm"] for i in r.json()["items"]] == ["BKR5EKB11"]


async def test_search_item_summary(client: AsyncClient) -> None:
    item = await _receive(client, "W 68/3", qty=3, supplier="Росско")
    s = await client.post(f"/api/stock/items/{item['id']}/sales", json={"qty": 1, "price": "540"})
    assert s.status_code == 201
    r = await client.get("/api/search", params={"q": "W683"})
    (found,) = r.json()["items"]
    assert found["last_receipt_supplier"] == "Росско"
    assert found["last_receipt_at"] is not None
    assert found["sold_30d"] == 1
    assert found["status"] == "ok"
    assert found["sale_price"] == "540.00"


async def test_search_empty_number_422(client: AsyncClient) -> None:
    r = await client.get("/api/search", params={"q": "-/."})
    assert r.status_code == 422
    assert r.json() == {"message": "Введите номер"}
    assert (await client.get("/api/search")).status_code == 422


async def test_search_no_store(client: AsyncClient) -> None:
    r = await client.get("/api/search", params={"q": "W683"})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
