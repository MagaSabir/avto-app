from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from httpx import AsyncClient
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


def _today() -> str:
    return datetime.now(UTC).astimezone(ZoneInfo("Europe/Moscow")).date().isoformat()


async def _receive(client: AsyncClient) -> dict[str, Any]:
    r = await client.post("/api/stock/receipts", json=RECEIPT)
    assert r.status_code == 201
    item: dict[str, Any] = r.json()["item"]
    return item


async def _op(
    client: AsyncClient, item: dict[str, Any], op: str, body: dict[str, Any]
) -> dict[str, Any]:
    r = await client.post(f"/api/stock/items/{item['id']}/{op}", json=body)
    assert r.status_code == 201
    move: dict[str, Any] = r.json()["move"]
    return move


async def _cash(client: AsyncClient, start: str | None = None, end: str | None = None) -> Any:
    day = _today()
    r = await client.get("/api/cash", params={"start": start or day, "end": end or day})
    assert r.status_code == 200
    return r.json()


async def test_cash_totals(client: AsyncClient) -> None:
    item = await _receive(client)
    await _op(client, item, "sales", {"qty": 2, "price": "540", "payment": "cash"})
    await _op(client, item, "sales", {"qty": 1, "price": "500", "payment": "transfer"})
    ret = await _op(client, item, "returns", {"qty": 1, "price": "540", "payment": "cash"})

    data = await _cash(client)
    totals = data["totals"]
    assert totals["sales"] == "1580.00"
    assert totals["returns"] == "540.00"
    assert totals["revenue"] == "1040.00"
    assert totals["cash"] == "540.00"
    assert totals["transfer"] == "500.00"
    assert totals["profit"] == "240.00"
    assert totals["no_cost_count"] == 0
    assert totals["no_payment_count"] == 0

    ops = data["operations"]
    assert [o["type"] for o in ops] == ["return", "sale", "sale"]
    first = ops[0]
    assert first["move_id"] == ret["id"]
    assert first["item_id"] == item["id"]
    assert first["number_raw"] == "W 68/3"
    assert first["brand"] == "MANN-FILTER"
    assert first["name"] == "Oil filter"
    assert first["qty"] == 1
    assert first["price"] == "540.00"
    assert first["amount"] == "540.00"
    assert first["payment"] == "cash"
    assert first["cost"] == "400.00"
    assert first["profit"] == "-140.00"
    assert first["user"] == "test"
    assert ops[2]["qty"] == 2
    assert ops[2]["amount"] == "1080.00"
    assert ops[2]["profit"] == "280.00"


async def test_cash_writeoffs(client: AsyncClient) -> None:
    item = await _receive(client)
    await _op(client, item, "sales", {"qty": 1, "price": "540", "payment": "cash"})
    await _op(client, item, "writeoffs", {"qty": 2, "comment": "брак"})

    data = await _cash(client)
    totals = data["totals"]
    assert totals["profit"] == "140.00"
    assert totals["writeoffs"] == "800.00"
    assert totals["writeoffs_no_cost_count"] == 0
    assert totals["profit_after_writeoffs"] == "-660.00"
    assert [o["type"] for o in data["operations"]] == ["sale"]


async def test_cash_ignores_cancelled(client: AsyncClient) -> None:
    item = await _receive(client)
    sale = await _op(client, item, "sales", {"qty": 2, "price": "540", "payment": "cash"})
    assert (await client.post(f"/api/stock/moves/{sale['id']}/cancel", json={})).status_code == 201
    writeoff = await _op(client, item, "writeoffs", {"qty": 1, "comment": "брак"})
    r = await client.post(f"/api/stock/moves/{writeoff['id']}/cancel", json={})
    assert r.status_code == 201

    data = await _cash(client)
    totals = data["totals"]
    assert totals["sales"] == "0.00"
    assert totals["revenue"] == "0.00"
    assert totals["profit"] == "0.00"
    assert totals["writeoffs"] == "0.00"
    assert data["operations"] == []


async def test_cash_old_moves_without_cost_or_payment(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _receive(client)
    sale = await _op(client, item, "sales", {"qty": 1, "price": "540", "payment": "cash"})
    writeoff = await _op(client, item, "writeoffs", {"qty": 1, "comment": "брак"})
    await db_session.execute(
        text("UPDATE stock_moves SET cost = NULL, payment = NULL WHERE id IN (:a, :b)"),
        {"a": sale["id"], "b": writeoff["id"]},
    )

    data = await _cash(client)
    totals = data["totals"]
    assert totals["sales"] == "540.00"
    assert totals["revenue"] == "540.00"
    assert totals["cash"] == "0.00"
    assert totals["transfer"] == "0.00"
    assert totals["profit"] == "0.00"
    assert totals["no_cost_count"] == 1
    assert totals["no_payment_count"] == 1
    assert totals["writeoffs"] == "0.00"
    assert totals["writeoffs_no_cost_count"] == 1
    op = data["operations"][0]
    assert op["profit"] is None
    assert op["cost"] is None
    assert op["payment"] is None


async def test_cash_moscow_day_boundary(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _receive(client)
    sale = await _op(client, item, "sales", {"qty": 1, "price": "540", "payment": "cash"})
    await db_session.execute(
        text("UPDATE stock_moves SET created_at = '2026-10-28 21:30+00' WHERE id = :id"),
        {"id": sale["id"]},
    )

    inside = await _cash(client, "2026-10-29", "2026-10-29")
    assert [o["move_id"] for o in inside["operations"]] == [sale["id"]]
    before = await _cash(client, "2026-10-28", "2026-10-28")
    assert before["operations"] == []


async def test_cash_invalid_period(client: AsyncClient) -> None:
    r = await client.get("/api/cash", params={"start": "2026-10-29", "end": "2026-10-28"})
    assert r.status_code == 422
    assert r.json()["message"] == "Неверный период"
    r = await client.get("/api/cash", params={"start": "2025-10-28", "end": "2026-10-29"})
    assert r.status_code == 422
    assert r.json()["message"] == "Неверный период"
    r = await client.get("/api/cash", params={"start": "2026-10-29"})
    assert r.status_code == 422


async def test_cash_return_at_cost_has_zero_profit(client: AsyncClient) -> None:
    item = await _receive(client)
    await _op(client, item, "returns", {"qty": 1, "price": "400", "payment": "cash"})

    data = await _cash(client)
    assert data["operations"][0]["profit"] == "0.00"
