from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.db import get_session
from app.main import create_app
from app.models.auth import User
from app.repositories import users as users_repository
from app.suppliers import get_suppliers
from app.suppliers.base import SupplierResult


class FakeSupplier:
    code = "rossko"
    title = "Росско"

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        return SupplierResult(groups=[], message=None)


@dataclass
class Env:
    client: httpx.AsyncClient
    user_a: User
    user_b: User
    holder: dict[str, User]

    def as_user(self, user: User) -> None:
        self.holder["user"] = user


@pytest.fixture
async def env(db_session: AsyncSession) -> AsyncIterator[Env]:
    user_a = await users_repository.add(db_session, "a", "x")
    user_b = await users_repository.add(db_session, "b", "x")
    holder = {"user": user_a}
    app = create_app()

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[current_user] = lambda: holder["user"]
    app.dependency_overrides[get_suppliers] = lambda: {"rossko": FakeSupplier()}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as c:
        yield Env(c, user_a, user_b, holder)


def _body(**over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "supplier": "rossko",
        "stock_id": "HST1",
        "brand": "mann",
        "number": "W 68/3",
        "name": "Фильтр",
        "warehouse": "Склад",
        "multiplicity": 1,
        "available": 5,
        "delivery_days": 2,
        "delivery_from": "2026-10-23T12:00:00+03:00",
        "delivery_to": "2026-10-24T12:00:00+03:00",
        "kind": "normal",
        "kind_code": "",
        "price": "412.00",
        "qty": 2,
    }
    body.update(over)
    return body


async def test_empty_cart(env: Env) -> None:
    r = await env.client.get("/api/cart")
    assert r.status_code == 200
    assert r.json() == {"items": [], "total": "0.00"}


async def test_add_and_list(env: Env) -> None:
    r = await env.client.post("/api/cart/items", json=_body())
    assert r.status_code == 201
    assert r.json()["sum"] == "824.00"
    cart = (await env.client.get("/api/cart")).json()
    assert len(cart["items"]) == 1
    assert cart["total"] == "824.00"
    assert cart["items"][0]["brand"] == "MANN"
    assert cart["items"][0]["number"] == "W 68/3"
    assert cart["items"][0]["number_norm"] == "W683"


async def test_add_rejects_bad_qty(env: Env) -> None:
    for qty in (3, 6, 0):
        r = await env.client.post("/api/cart/items", json=_body(multiplicity=2, qty=qty))
        assert r.status_code == 422, qty
    r = await env.client.post("/api/cart/items", json=_body(multiplicity=2, qty=3))
    assert r.json()["message"] == "Количество должно быть кратно 2 и не больше 5"


async def test_add_unknown_supplier(env: Env) -> None:
    r = await env.client.post("/api/cart/items", json=_body(supplier="nope"))
    assert r.status_code == 422


async def test_add_same_offer_sums_and_updates_price(env: Env) -> None:
    await env.client.post("/api/cart/items", json=_body(qty=1))
    r = await env.client.post("/api/cart/items", json=_body(qty=2, price="430.00"))
    assert r.status_code == 201
    items = (await env.client.get("/api/cart")).json()["items"]
    assert len(items) == 1
    assert items[0]["qty"] == 3
    assert items[0]["price"] == "430.00"


async def test_add_same_offer_caps_at_available(env: Env) -> None:
    body = _body(multiplicity=2, available=5, qty=4)
    await env.client.post("/api/cart/items", json=body)
    r = await env.client.post("/api/cart/items", json=body)
    assert r.json()["qty"] == 4


async def test_different_stock_is_new_line(env: Env) -> None:
    await env.client.post("/api/cart/items", json=_body())
    await env.client.post("/api/cart/items", json=_body(stock_id="HST2"))
    assert len((await env.client.get("/api/cart")).json()["items"]) == 2


async def test_set_qty(env: Env) -> None:
    item = (await env.client.post("/api/cart/items", json=_body(multiplicity=2, qty=2))).json()
    url = f"/api/cart/items/{item['id']}"
    r = await env.client.patch(url, json={"qty": 4})
    assert r.status_code == 200
    assert r.json()["qty"] == 4
    assert (await env.client.patch(url, json={"qty": 3})).status_code == 422
    assert (await env.client.patch(url, json={"qty": 6})).status_code == 422


async def test_remove_and_clear(env: Env) -> None:
    item = (await env.client.post("/api/cart/items", json=_body())).json()
    await env.client.post("/api/cart/items", json=_body(stock_id="HST2"))
    r = await env.client.delete(f"/api/cart/items/{item['id']}")
    assert r.status_code == 204
    assert len((await env.client.get("/api/cart")).json()["items"]) == 1
    assert (await env.client.delete("/api/cart")).status_code == 204
    assert (await env.client.get("/api/cart")).json()["items"] == []


async def test_other_users_items_are_invisible(env: Env) -> None:
    item = (await env.client.post("/api/cart/items", json=_body())).json()
    url = f"/api/cart/items/{item['id']}"
    env.as_user(env.user_b)
    assert (await env.client.get("/api/cart")).json()["items"] == []
    assert (await env.client.patch(url, json={"qty": 1})).status_code == 404
    assert (await env.client.delete(url)).status_code == 404
    assert (await env.client.delete("/api/cart")).status_code == 204
    env.as_user(env.user_a)
    assert len((await env.client.get("/api/cart")).json()["items"]) == 1


async def test_cart_requires_login(anon_client: httpx.AsyncClient) -> None:
    assert (await anon_client.get("/api/cart")).status_code == 401


async def test_add_rejects_empty_brand_or_number(env: Env) -> None:
    for field_name in ("brand", "number"):
        r = await env.client.post("/api/cart/items", json=_body(**{field_name: ""}))
        assert r.status_code == 422, field_name


async def test_add_with_order_code(env: Env) -> None:
    r = await env.client.post(
        "/api/cart/items", json=_body(stock_id="xmn-w68/3#13", order_code="xmn-w68/3")
    )
    assert r.status_code == 201
    assert r.json()["order_code"] == "xmn-w68/3"
    assert (await env.client.get("/api/cart")).json()["items"][0]["order_code"] == "xmn-w68/3"


async def test_order_code_defaults_to_null(env: Env) -> None:
    r = await env.client.post("/api/cart/items", json=_body())
    assert r.json()["order_code"] is None


async def test_add_rejects_variants_kind(env: Env) -> None:
    r = await env.client.post("/api/cart/items", json=_body(kind="variants"))
    assert r.status_code == 422
    assert r.json()["message"] == "Выберите вариант поставки"
