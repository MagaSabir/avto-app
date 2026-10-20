from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import StockMove


async def _receive(client: AsyncClient, qty: int = 3) -> dict[str, Any]:
    r = await client.post(
        "/api/stock/receipts",
        json={
            "number": "W 68/3",
            "brand": "MANN-FILTER",
            "name": "Oil filter",
            "qty": qty,
            "purchase_price": "412.00",
            "markup": "30",
            "sale_price": "540",
        },
    )
    assert r.status_code == 201
    item: dict[str, Any] = r.json()["item"]
    return item


def _url(item: dict[str, Any], op: str) -> str:
    return f"/api/stock/items/{item['id']}/{op}"


async def test_sale(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "sales"), json={"qty": 2, "price": "540"})
    assert r.status_code == 201
    data = r.json()
    assert data["item"]["qty"] == 1
    assert data["item"]["status"] == "low"
    assert data["item"]["sale_price"] == "540.00"
    assert data["move"]["type"] == "sale"
    assert data["move"]["qty_delta"] == -2
    assert data["move"]["price"] == "540.00"


async def test_sale_below_purchase_allowed(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "sales"), json={"qty": 1, "price": "100"})
    assert r.status_code == 201


async def test_sale_whole_stock(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "sales"), json={"qty": 3, "price": "540"})
    assert r.status_code == 201
    assert r.json()["item"]["qty"] == 0
    assert r.json()["item"]["status"] == "out"
    again = {
        "number": "W 68/3",
        "brand": "MANN-FILTER",
        "name": "Oil filter",
        "qty": 1,
        "purchase_price": "412.00",
        "markup": "30",
        "sale_price": "540",
    }
    r = await client.post("/api/stock/receipts", json=again)
    assert r.json()["item"]["status"] == "low"
    r = await client.post("/api/stock/receipts", json=again)
    assert r.json()["item"]["status"] == "ok"


async def test_sale_over_stock(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "sales"), json={"qty": 4, "price": "540"})
    assert r.status_code == 409
    assert r.json() == {"message": "Недостаточно на складе: остаток 3"}
    r = await client.post(_url(item, "returns"), json={"qty": 1, "price": "540"})
    assert r.json()["item"]["qty"] == 4


async def test_sale_invalid_input(client: AsyncClient) -> None:
    item = await _receive(client)
    for body in (
        {"qty": 0, "price": "540"},
        {"qty": 1, "price": "0"},
        {"qty": 1, "price": "5.123"},
    ):
        r = await client.post(_url(item, "sales"), json=body)
        assert r.status_code == 422


async def test_return(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "returns"), json={"qty": 1, "price": "540"})
    assert r.status_code == 201
    data = r.json()
    assert data["item"]["qty"] == 4
    assert data["move"]["type"] == "return"
    assert data["move"]["qty_delta"] == 1


async def test_writeoff(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "writeoffs"), json={"qty": 1, "comment": "брак"})
    assert r.status_code == 201
    data = r.json()
    assert data["item"]["qty"] == 2
    assert data["move"]["type"] == "writeoff"
    assert data["move"]["comment"] == "брак"
    assert data["move"]["qty_delta"] == -1
    assert (await client.post(_url(item, "writeoffs"), json={"qty": 1})).status_code == 422
    r = await client.post(_url(item, "writeoffs"), json={"qty": 1, "comment": "  "})
    assert r.status_code == 422
    r = await client.post(_url(item, "writeoffs"), json={"qty": 5, "comment": "x"})
    assert r.status_code == 409


async def test_adjustment(client: AsyncClient) -> None:
    item = await _receive(client)
    r = await client.post(_url(item, "adjustments"), json={"actual_qty": 1})
    assert r.status_code == 201
    move = r.json()["move"]
    assert move["type"] == "adjustment"
    assert move["qty_delta"] == -2
    assert move["qty_after"] == 1
    r = await client.post(_url(item, "adjustments"), json={"actual_qty": 1})
    assert r.status_code == 422
    assert r.json() == {"message": "Остаток не изменился"}
    r = await client.post(_url(item, "adjustments"), json={"actual_qty": 0})
    assert r.status_code == 201
    assert r.json()["item"]["qty"] == 0


async def test_unknown_item(client: AsyncClient) -> None:
    r = await client.post("/api/stock/items/999999/sales", json={"qty": 1, "price": "540"})
    assert r.status_code == 404
    assert r.json() == {"message": "Позиция не найдена"}


async def test_qty_matches_moves(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _receive(client, qty=5)
    await client.post(_url(item, "sales"), json={"qty": 2, "price": "540"})
    await client.post(_url(item, "returns"), json={"qty": 1, "price": "540"})
    await client.post(_url(item, "writeoffs"), json={"qty": 1, "comment": "брак"})
    r = await client.post(_url(item, "adjustments"), json={"actual_qty": 7})
    qty = r.json()["item"]["qty"]
    total = await db_session.scalar(
        select(func.sum(StockMove.qty_delta)).where(StockMove.item_id == item["id"])
    )
    last = await db_session.scalar(
        select(StockMove.qty_after)
        .where(StockMove.item_id == item["id"])
        .order_by(StockMove.id.desc())
        .limit(1)
    )
    assert qty == total == last == 7
