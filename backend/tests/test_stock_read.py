from typing import Any

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def _receive(
    client: AsyncClient,
    number: str = "W 68/3",
    brand: str = "MANN-FILTER",
    name: str = "Масляный фильтр",
    qty: int = 3,
    supplier: str | None = None,
) -> dict[str, Any]:
    r = await client.post(
        "/api/stock/receipts",
        json={
            "number": number,
            "brand": brand,
            "name": name,
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


async def _op(client: AsyncClient, item: dict[str, Any], op: str, qty: int) -> None:
    r = await client.post(f"/api/stock/items/{item['id']}/{op}", json={"qty": qty, "price": "540"})
    assert r.status_code == 201


async def test_list_filters_and_counts(client: AsyncClient) -> None:
    await _receive(client, number="A1", qty=1)  # will be out
    out = (await client.get("/api/stock/items")).json()["items"][0]
    await _op(client, out, "sales", 1)
    await _receive(client, number="B1", qty=1)  # low
    await _receive(client, number="C1", qty=5)  # ok
    r = await client.get("/api/stock/items")
    data = r.json()
    assert len(data["items"]) == 3
    assert data["counts"] == {"all": 3, "low": 1, "out": 1}
    low = (await client.get("/api/stock/items?status=low")).json()
    assert [i["number_norm"] for i in low["items"]] == ["B1"]
    assert low["counts"] == {"all": 3, "low": 1, "out": 1}
    out_list = (await client.get("/api/stock/items?status=out")).json()
    assert [i["number_norm"] for i in out_list["items"]] == ["A1"]


async def test_list_search(client: AsyncClient) -> None:
    await _receive(client)
    await _receive(client, number="X1", brand="KYB", name="Амортизатор")
    by_number = (await client.get("/api/stock/items", params={"q": "w 68/3"})).json()
    assert [i["number_raw"] for i in by_number["items"]] == ["W 68/3"]
    assert by_number["counts"]["all"] == 1
    by_brand = (await client.get("/api/stock/items", params={"q": "mann"})).json()
    assert len(by_brand["items"]) == 1
    by_name = (await client.get("/api/stock/items", params={"q": "масл"})).json()
    assert len(by_name["items"]) == 1
    wildcard = (await client.get("/api/stock/items", params={"q": "%"})).json()
    assert wildcard["items"] == []


async def test_item_detail_summary(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _receive(client, supplier="Росско")
    await _op(client, item, "sales", 2)
    await _op(client, item, "returns", 1)
    r = await client.get(f"/api/stock/items/{item['id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["last_receipt_supplier"] == "Росско"
    assert data["last_receipt_at"] is not None
    assert data["last_sale_at"] is not None
    assert data["sold_30d"] == 1
    assert data["status"] == "ok"

    await db_session.execute(
        text("UPDATE stock_moves SET created_at = now() - interval '31 days' WHERE type = 'sale'")
    )
    data = (await client.get(f"/api/stock/items/{item['id']}")).json()
    assert data["sold_30d"] == 0


async def test_item_detail_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/stock/items/999999")
    assert r.status_code == 404
    assert r.json() == {"message": "Позиция не найдена"}
    assert (await client.get("/api/stock/items/999999/moves")).status_code == 404


async def test_moves_newest_first(client: AsyncClient) -> None:
    item = await _receive(client)
    await _op(client, item, "sales", 1)
    r = await client.get(f"/api/stock/items/{item['id']}/moves")
    assert [m["type"] for m in r.json()] == ["sale", "receipt"]


async def test_lookup_brands_suppliers(client: AsyncClient) -> None:
    await _receive(client, supplier="Росско")
    await _receive(client, number="X1", brand="KYB")
    r = await client.get("/api/stock/lookup", params={"number": "w68-3"})
    assert [i["number_norm"] for i in r.json()] == ["W683"]
    assert (await client.get("/api/stock/lookup", params={"number": " - "})).json() == []
    assert (await client.get("/api/stock/brands")).json() == ["KYB", "MANN-FILTER"]
    assert (await client.get("/api/stock/suppliers")).json() == ["Росско"]


async def test_patch_item(client: AsyncClient) -> None:
    item = await _receive(client)
    url = f"/api/stock/items/{item['id']}"
    r = await client.patch(url, json={"name": "Фильтр", "cell": "B-1-3", "min_qty": 3})
    assert r.status_code == 200
    data = r.json()
    assert (data["name"], data["cell"], data["min_qty"], data["qty"]) == ("Фильтр", "B-1-3", 3, 3)
    assert data["status"] == "low"
    assert len((await client.get(f"{url}/moves")).json()) == 1

    assert (await client.patch(url, json={"min_qty": -1})).status_code == 422
    assert (await client.patch(url, json={"qty": 10})).status_code == 422
    assert (await client.patch(url, json={"name": "   "})).status_code == 422
    assert (await client.patch(url, json={"sale_price": "0"})).status_code == 422
    assert (await client.patch(url, json={"purchase_price": "1.234"})).status_code == 422
    r = await client.patch("/api/stock/items/999999", json={"min_qty": 1})
    assert r.status_code == 404
    assert r.json() == {"message": "Позиция не найдена"}
