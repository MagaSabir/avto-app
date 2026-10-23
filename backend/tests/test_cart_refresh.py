from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.db import get_session
from app.main import create_app
from app.models.auth import User
from app.repositories import users as users_repository
from app.suppliers import get_suppliers
from app.suppliers.base import CartLine, Offer, PartGroup, SupplierError, SupplierResult
from app.suppliers.mikado import URL, DailyLimit, MikadoSupplier
from app.suppliers.rossko import check_lines
from tests.suppliers.test_mikado_client import FIXTURES
from tests.test_cart_api import _body


def _offer(stock_id: str = "HST1", price: str = "450.00", qty: int = 7) -> Offer:
    return Offer(
        warehouse="Склад 2",
        stock_id=stock_id,
        qty=qty,
        multiplicity=1,
        delivery_days=3,
        delivery_from=None,
        delivery_to=None,
        kind="normal",
        kind_code="",
        purchase_price=Decimal(price),
    )


def _result(
    *offers: Offer, brand: str = "MANN", number: str = "W683", message: str | None = None
) -> SupplierResult:
    group = PartGroup(
        brand=brand,
        number=number,
        number_norm=number,
        name="Фильтр",
        is_requested=True,
        offers=list(offers),
        key="k",
        analog_of=[],
    )
    return SupplierResult(groups=[group], message=message)


@dataclass
class FakeSupplier:
    code = "rossko"
    title = "Росско"
    responses: dict[str, SupplierResult | SupplierError] = field(default_factory=dict)
    calls: list[str] = field(default_factory=list)
    on_search: Callable[[str], Awaitable[None]] | None = None

    async def check_offers(self, lines: list[CartLine]) -> dict[str, Offer | None]:
        return await check_lines(self.search, lines)

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        self.calls.append(number)
        if self.on_search is not None:
            await self.on_search(number)
        response = self.responses[number]
        if isinstance(response, SupplierError):
            raise response
        return response


@dataclass
class Env:
    client: httpx.AsyncClient
    supplier: FakeSupplier
    user_a: User
    user_b: User
    holder: dict[str, User]
    supplier_map: dict[str, FakeSupplier]


@pytest.fixture
async def env(db_session: AsyncSession) -> AsyncIterator[Env]:
    user_a = await users_repository.add(db_session, "a", "x")
    user_b = await users_repository.add(db_session, "b", "x")
    holder = {"user": user_a}
    supplier = FakeSupplier()
    supplier_map = {"rossko": supplier}
    app = create_app()

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[current_user] = lambda: holder["user"]
    app.dependency_overrides[get_suppliers] = lambda: supplier_map
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as c:
        yield Env(c, supplier, user_a, user_b, holder, supplier_map)


async def _add(env: Env, **over: Any) -> dict[str, Any]:
    r = await env.client.post("/api/cart/items", json=_body(**over))
    assert r.status_code == 201
    return r.json()


async def _refresh(env: Env) -> dict[str, Any]:
    r = await env.client.post("/api/cart/refresh", json={})
    assert r.status_code == 200
    return r.json()


async def test_refresh_updates_changed_price(env: Env) -> None:
    await _add(env)
    env.supplier.responses["W 68/3"] = _result(_offer(price="450.00", qty=7))
    body = await _refresh(env)
    assert body["status"] == "ok"
    item = body["items"][0]
    assert item["state"] == "ok"
    assert item["previous_price"] == "412.00"
    assert item["price"] == "450.00"
    assert item["available"] == 7
    cart_item = (await env.client.get("/api/cart")).json()["items"][0]
    assert cart_item["price"] == "450.00"
    assert cart_item["available"] == 7
    assert cart_item["warehouse"] == "Склад 2"


async def test_refresh_unchanged_price(env: Env) -> None:
    await _add(env)
    env.supplier.responses["W 68/3"] = _result(_offer(price="412.00"))
    item = (await _refresh(env))["items"][0]
    assert item["state"] == "ok"
    assert item["previous_price"] is None


async def test_refresh_gone_offer(env: Env) -> None:
    await _add(env)
    env.supplier.responses["W 68/3"] = _result(_offer(stock_id="OTHER"))
    item = (await _refresh(env))["items"][0]
    assert item["state"] == "gone"
    assert item["price"] == "412.00"
    assert (await env.client.get("/api/cart")).json()["items"][0]["price"] == "412.00"


async def test_refresh_partial_supplier_error(env: Env) -> None:
    x = await _add(env, number="X1", stock_id="S1")
    y = await _add(env, number="Y1", stock_id="S2")
    env.supplier.responses["X1"] = SupplierError("Росско недоступен")
    env.supplier.responses["Y1"] = _result(_offer(stock_id="S2", price="500.00"), number="Y1")
    body = await _refresh(env)
    assert body["status"] == "error"
    assert body["message"] == "Росско недоступен"
    by_id = {i["id"]: i for i in body["items"]}
    assert by_id[x["id"]]["state"] == "unknown"
    assert by_id[x["id"]]["price"] == "412.00"
    assert by_id[y["id"]]["state"] == "ok"
    assert by_id[y["id"]]["price"] == "500.00"


async def test_refresh_queries_each_number_once(env: Env) -> None:
    await _add(env, stock_id="HST1")
    await _add(env, stock_id="HST2")
    env.supplier.responses["W 68/3"] = _result(_offer("HST1"), _offer("HST2", price="460.00"))
    body = await _refresh(env)
    assert env.supplier.calls == ["W 68/3"]
    assert [i["state"] for i in body["items"]] == ["ok", "ok"]


async def test_refresh_empty_cart(env: Env) -> None:
    r = await env.client.post("/api/cart/refresh", json={})
    assert r.json() == {"status": "ok", "message": None, "items": []}
    assert env.supplier.calls == []


async def test_refresh_only_own_items(env: Env) -> None:
    a = await _add(env)
    env.holder["user"] = env.user_b
    b = await _add(env)
    env.supplier.responses["W 68/3"] = _result(_offer(price="999.00"))
    body = await _refresh(env)
    assert [i["id"] for i in body["items"]] == [b["id"]]
    env.holder["user"] = env.user_a
    cart = (await env.client.get("/api/cart")).json()
    assert cart["items"][0]["id"] == a["id"]
    assert cart["items"][0]["price"] == "412.00"


async def test_refresh_unknown_supplier_message(env: Env) -> None:
    await _add(env)
    env.supplier_map.clear()
    body = await _refresh(env)
    assert body["status"] == "error"
    assert body["message"] == "Неизвестный поставщик"
    assert body["items"][0]["state"] == "unknown"


async def test_refresh_survives_row_deleted_meanwhile(env: Env) -> None:
    x = await _add(env, number="X1", stock_id="S1")
    y = await _add(env, number="Y1", stock_id="S2")
    env.supplier.responses["X1"] = _result(_offer(stock_id="S1", price="500.00"), number="X1")
    env.supplier.responses["Y1"] = _result(_offer(stock_id="S2", price="600.00"), number="Y1")

    async def on_search(number: str) -> None:
        if number == "X1":
            assert (await env.client.delete(f"/api/cart/items/{x['id']}")).status_code == 204

    env.supplier.on_search = on_search
    body = await _refresh(env)
    assert [i["id"] for i in body["items"]] == [y["id"]]
    assert body["items"][0]["price"] == "600.00"
    cart = (await env.client.get("/api/cart")).json()
    assert [i["id"] for i in cart["items"]] == [y["id"]]
    assert cart["items"][0]["price"] == "600.00"


async def test_refresh_survives_cart_cleared_meanwhile(env: Env) -> None:
    await _add(env)
    env.supplier.responses["W 68/3"] = _result(_offer(price="500.00"))

    async def on_search(number: str) -> None:
        assert (await env.client.delete("/api/cart")).status_code == 204

    env.supplier.on_search = on_search
    body = await _refresh(env)
    assert body["items"] == []
    assert (await env.client.get("/api/cart")).json()["items"] == []


@respx.mock
async def test_refresh_mikado_line_updates_price(env: Env) -> None:
    env.supplier_map["mikado"] = MikadoSupplier("C", "P")  # type: ignore[assignment]
    respx.post(URL.format(method="CodeBrandStockInfo")).respond(
        200, content=(FIXTURES / "mikado_cbsi.xml").read_bytes()
    )
    await _add(
        env,
        supplier="mikado",
        stock_id="xmn-w68/3|95",
        brand="MANN",
        order_code="xmn-w68/3",
        price="500.00",
    )
    body = await _refresh(env)
    item = body["items"][0]
    assert item["state"] == "ok"
    assert item["previous_price"] == "500.00"
    assert item["price"] == "574.75"


@respx.mock
async def test_refresh_mikado_error_keeps_line_unknown(env: Env) -> None:
    env.supplier_map["mikado"] = MikadoSupplier("C", "P", daily=DailyLimit(0))  # type: ignore[assignment]
    await _add(
        env,
        supplier="mikado",
        stock_id="xmn-w68/3#13",
        brand="MANN",
        order_code="xmn-w68/3",
        kind="order",
    )
    body = await _refresh(env)
    assert body["status"] == "error"
    assert body["message"] == "Лимит запросов к Микадо на сегодня исчерпан"
    assert body["items"][0]["state"] == "unknown"


async def test_refresh_keeps_order_max_for_under_order_line(env: Env) -> None:
    await _add(env, kind="order", available=0, qty=3)
    order_offer = Offer(
        warehouse="Под заказ",
        stock_id="HST1",
        qty=0,
        multiplicity=1,
        delivery_days=7,
        delivery_from=None,
        delivery_to=None,
        kind="order",
        kind_code="",
        purchase_price=Decimal("450.00"),
    )
    env.supplier.responses["W 68/3"] = _result(order_offer)
    item = (await _refresh(env))["items"][0]
    assert item["state"] == "ok"
    assert item["available"] == 999
    assert (await env.client.get("/api/cart")).json()["items"][0]["available"] == 999
