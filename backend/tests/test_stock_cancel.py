from typing import Any

from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import StockMove

RECEIPT = {
    "number": "W 68/3",
    "brand": "MANN-FILTER",
    "name": "Oil filter",
    "qty": 3,
    "purchase_price": "412.00",
    "markup": "30",
    "sale_price": "540",
}


async def _receive(client: AsyncClient, **extra: Any) -> dict[str, Any]:
    r = await client.post("/api/stock/receipts", json={**RECEIPT, **extra})
    assert r.status_code == 201
    return r.json()


def _op(item: dict[str, Any], op: str) -> str:
    return f"/api/stock/items/{item['id']}/{op}"


async def _sell(client: AsyncClient, item: dict[str, Any], qty: int = 2) -> dict[str, Any]:
    r = await client.post(_op(item, "sales"), json={"qty": qty, "price": "540", "payment": "cash"})
    assert r.status_code == 201
    return r.json()["move"]


async def _cancel(client: AsyncClient, move_id: int) -> Any:
    return await client.post(f"/api/stock/moves/{move_id}/cancel", json={})


async def _moves(client: AsyncClient, item: dict[str, Any]) -> list[dict[str, Any]]:
    r = await client.get(f"/api/stock/items/{item['id']}/moves")
    assert r.status_code == 200
    moves: list[dict[str, Any]] = r.json()
    return moves


async def _get_item(client: AsyncClient, item: dict[str, Any]) -> dict[str, Any]:
    r = await client.get(f"/api/stock/items/{item['id']}")
    data: dict[str, Any] = r.json()
    return data


async def test_cancel_sale(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    r = await _cancel(client, sale["id"])
    assert r.status_code == 201
    data = r.json()
    assert data["item"]["qty"] == 3
    assert data["move"]["type"] == "cancel"
    assert data["move"]["qty_delta"] == 2
    assert data["move"]["cancels_move_id"] == sale["id"]
    assert data["move"]["cancellable"] is False
    assert data["move"]["price"] is None
    assert data["move"]["cost"] is None
    assert data["move"]["payment"] is None
    assert data["move"]["comment"] is None
    moves = await _moves(client, item)
    by_id = {m["id"]: m for m in moves}
    assert by_id[sale["id"]]["cancelled"] is True
    assert by_id[sale["id"]]["cancellable"] is False
    assert by_id[data["move"]["id"]]["cancellable"] is False


async def test_cancel_each_type(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    ops = [
        ("returns", {"qty": 2, "price": "540", "payment": "transfer"}),
        ("writeoffs", {"qty": 1, "comment": "broken"}),
        ("adjustments", {"actual_qty": 9, "comment": "recount"}),
    ]
    for op, body in ops:
        before = (await _get_item(client, item))["qty"]
        r = await client.post(_op(item, op), json=body)
        assert r.status_code == 201, r.text
        move = r.json()["move"]
        if op == "returns":
            assert move["payment"] == "transfer"
            assert move["user"] == "test"
        r = await _cancel(client, move["id"])
        assert r.status_code == 201, r.text
        assert r.json()["item"]["qty"] == before


async def test_cancel_receipt_restores_prices(client: AsyncClient) -> None:
    await _receive(client)
    second = await _receive(client, purchase_price="500.00", markup="20", sale_price="600", qty=2)
    assert second["item"]["purchase_price"] == "500.00"
    r = await _cancel(client, second["move"]["id"])
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["qty"] == 3
    assert item["purchase_price"] == "412.00"
    assert item["markup"] == "30.00"
    assert item["sale_price"] == "540.00"


async def test_receipt_keep_policy_stores_prev_and_cancel_keeps_prices(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _receive(client)
    second = await _receive(
        client,
        purchase_price="500.00",
        markup="20",
        sale_price="600",
        qty=2,
        price_policy="keep",
    )
    assert second["item"]["purchase_price"] == "412.00"
    stored = (
        await db_session.execute(select(StockMove).where(StockMove.id == second["move"]["id"]))
    ).scalar_one()
    assert stored.prev_purchase_price is not None
    r = await _cancel(client, second["move"]["id"])
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["qty"] == 3
    assert item["purchase_price"] == "412.00"
    assert item["markup"] == "30.00"
    assert item["sale_price"] == "540.00"


async def test_cancel_first_receipt(client: AsyncClient) -> None:
    first = await _receive(client)
    r = await _cancel(client, first["move"]["id"])
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["qty"] == 0
    assert item["purchase_price"] == "412.00"
    assert item["sale_price"] == "540.00"
    assert (await client.get(f"/api/stock/items/{item['id']}")).status_code == 200


async def test_cancel_by_stale_id(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    first = await _sell(client, item, 1)
    await _sell(client, item, 1)
    r = await _cancel(client, first["id"])
    assert r.status_code == 409
    assert r.json() == {"message": "Это уже не последняя операция"}
    assert (await _get_item(client, item))["qty"] == 1


async def test_cancel_twice(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    await _cancel(client, sale["id"])
    r = await _cancel(client, sale["id"])
    assert r.status_code == 409
    assert r.json() == {"message": "Операция уже отменена"}


async def test_cancel_the_cancel(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    cancel = (await _cancel(client, sale["id"])).json()["move"]
    r = await _cancel(client, cancel["id"])
    assert r.status_code == 409
    assert r.json() == {"message": "Отмену отменить нельзя"}


async def test_cancel_too_old(client: AsyncClient, db_session: AsyncSession) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    await db_session.execute(
        text("UPDATE stock_moves SET created_at = now() - interval '48 hours' WHERE id < :i"),
        {"i": sale["id"]},
    )
    await db_session.execute(
        text(
            "UPDATE stock_moves SET created_at = now() - interval '24 hours 1 second' WHERE id = :i"
        ),
        {"i": sale["id"]},
    )
    r = await _cancel(client, sale["id"])
    assert r.status_code == 409
    assert r.json() == {"message": "Прошло больше 24 часов"}


async def test_cancel_unknown(client: AsyncClient) -> None:
    r = await _cancel(client, 999999)
    assert r.status_code == 404
    assert r.json() == {"message": "Операция не найдена"}


async def test_summary_ignores_cancelled(client: AsyncClient) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    await _cancel(client, sale["id"])
    detail = await _get_item(client, item)
    assert detail["sold_30d"] == 0
    assert detail["last_sale_at"] is None


async def test_delete_item_with_cancel_moves(client: AsyncClient, db_session: AsyncSession) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    await _cancel(client, sale["id"])
    r = await client.delete(
        f"/api/stock/items/{item['id']}", headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 204
    left = (
        await db_session.execute(select(StockMove).where(StockMove.item_id == item["id"]))
    ).all()
    assert left == []


async def test_last_move_follows_insert_order(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = (await _receive(client))["item"]
    sale = await _sell(client, item)
    await db_session.execute(
        text("UPDATE stock_moves SET created_at = now() - interval '1 hour' WHERE id = :i"),
        {"i": sale["id"]},
    )
    await db_session.execute(
        text("UPDATE stock_moves SET created_at = now() - interval '2 hours' WHERE id < :i"),
        {"i": sale["id"]},
    )
    await db_session.execute(
        text("UPDATE stock_moves SET created_at = now() - interval '3 hours' WHERE id = :i"),
        {"i": sale["id"]},
    )
    moves = await _moves(client, item)
    assert moves[0]["id"] == sale["id"]
    older = moves[1]["id"]
    r = await _cancel(client, older)
    assert r.status_code == 409
    assert r.json() == {"message": "Это уже не последняя операция"}
    assert (await _cancel(client, sale["id"])).status_code == 201
