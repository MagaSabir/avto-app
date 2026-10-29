from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import StockMove


def _body(**over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "number": "W 68/3",
        "brand": " mann-filter",
        "name": "Oil filter",
        "qty": 4,
        "cell": "A1",
        "purchase_price": "412.00",
        "markup": "30",
        "sale_price": "540",
    }
    body.update(over)
    return body


async def test_receipt_creates_item(client: AsyncClient) -> None:
    r = await client.post("/api/stock/receipts", json=_body())
    assert r.status_code == 201
    data = r.json()
    item, move = data["item"], data["move"]
    assert item["number_raw"] == "W 68/3"
    assert item["number_norm"] == "W683"
    assert item["brand"] == "MANN-FILTER"
    assert item["qty"] == 4
    assert item["min_qty"] == 1
    assert item["status"] == "ok"
    assert item["purchase_price"] == "412.00"
    assert item["markup"] == "30.00"
    assert item["sale_price"] == "540.00"
    assert move["type"] == "receipt"
    assert move["qty_delta"] == 4
    assert move["qty_after"] == 4
    assert move["price"] == "412.00"


async def test_receipt_same_item_other_spelling(client: AsyncClient) -> None:
    first = (await client.post("/api/stock/receipts", json=_body())).json()
    r = await client.post(
        "/api/stock/receipts", json=_body(number="w 68-3", brand="MANN-FILTER", qty=3)
    )
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["id"] == first["item"]["id"]
    assert item["qty"] == 7
    assert item["number_raw"] == "W 68/3"


async def test_receipt_brand_normalized_match(client: AsyncClient) -> None:
    first = (await client.post("/api/stock/receipts", json=_body(brand="MANN FILTER"))).json()
    r = await client.post("/api/stock/receipts", json=_body(brand=" mann  filter "))
    assert r.json()["item"]["id"] == first["item"]["id"]


async def _existing(client: AsyncClient) -> None:
    r = await client.post(
        "/api/stock/receipts",
        json=_body(purchase_price="405", sale_price="530", name="Old", cell="Z9"),
    )
    assert r.status_code == 201


async def test_receipt_update_policy(client: AsyncClient) -> None:
    await _existing(client)
    r = await client.post("/api/stock/receipts", json=_body(price_policy="update"))
    item = r.json()["item"]
    assert (item["purchase_price"], item["markup"], item["sale_price"]) == (
        "412.00",
        "30.00",
        "540.00",
    )
    assert item["name"] == "Oil filter"
    assert item["cell"] == "A1"


async def test_receipt_keep_policy(client: AsyncClient) -> None:
    await _existing(client)
    r = await client.post("/api/stock/receipts", json=_body(price_policy="keep"))
    item, move = r.json()["item"], r.json()["move"]
    assert (item["purchase_price"], item["markup"], item["sale_price"]) == (
        "405.00",
        "30.00",
        "530.00",
    )
    assert move["price"] == "412.00"
    assert item["name"] == "Oil filter"
    assert item["cell"] == "A1"


async def test_receipt_empty_optional_strings_become_null(client: AsyncClient) -> None:
    r = await client.post("/api/stock/receipts", json=_body(cell="", supplier=" ", comment=""))
    assert r.json()["item"]["cell"] is None
    assert r.json()["move"]["supplier"] is None
    assert r.json()["move"]["comment"] is None


async def test_receipt_validation(client: AsyncClient) -> None:
    for over in (
        {"qty": 0},
        {"purchase_price": "0"},
        {"number": "@7804"},
        {"brand": "  "},
        {"sale_price": "0"},
        {"markup": "10000", "sale_price": "10010.00"},
    ):
        r = await client.post("/api/stock/receipts", json=_body(**over))
        assert r.status_code == 422, over


async def test_receipt_negative_markup(client: AsyncClient) -> None:
    r = await client.post("/api/stock/receipts", json=_body(markup="-27.18", sale_price="300.00"))
    assert r.status_code == 201
    assert r.json()["item"]["markup"] == "-27.18"


async def test_receipt_markup_minus_100_rejected(client: AsyncClient) -> None:
    r = await client.post("/api/stock/receipts", json=_body(markup="-100"))
    assert r.status_code == 422


async def test_receipt_max_markup_accepted(client: AsyncClient) -> None:
    r = await client.post(
        "/api/stock/receipts",
        json=_body(purchase_price="1.00", markup="9999.99", sale_price="110.00"),
    )
    assert r.status_code == 201
    assert r.json()["item"]["markup"] == "9999.99"


async def test_receipt_stores_prev_prices(client: AsyncClient, db_session: AsyncSession) -> None:
    await client.post("/api/stock/receipts", json=_body())
    await client.post(
        "/api/stock/receipts",
        json=_body(purchase_price="500", markup="40", sale_price="700", price_policy="update"),
    )
    rows = (
        (
            await db_session.execute(
                select(StockMove).where(StockMove.type == "receipt").order_by(StockMove.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert (rows[0].prev_purchase_price, rows[0].prev_markup, rows[0].prev_sale_price) == (
        None,
        None,
        None,
    )
    assert rows[1].prev_purchase_price == Decimal("412.00")
    assert rows[1].prev_markup == 30
    assert rows[1].prev_sale_price == 540
