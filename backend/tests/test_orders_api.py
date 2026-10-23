from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.api.deps import current_user
from app.main import create_app
from app.models.auth import User
from app.suppliers import get_suppliers
from app.suppliers.base import Orders, Supplier, SupplierError, SupplierResult
from app.suppliers.rossko import parse_orders

ORDERS = Orders(
    orders=parse_orders((Path(__file__).parent / "fixtures" / "rossko_orders.xml").read_bytes()),
    truncated=False,
)


class SearchOnlySupplier:
    code = "fake"
    title = "Фейк"

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        return SupplierResult(groups=[], message=None)


class FakeSupplier(SearchOnlySupplier):
    def __init__(self, result: Orders | SupplierError) -> None:
        self.result = result
        self.calls: list[tuple[date | None, date | None, int | None]] = []

    async def orders(
        self,
        start: date | None = None,
        end: date | None = None,
        order_id: int | None = None,
    ) -> Orders:
        self.calls.append((start, end, order_id))
        if isinstance(self.result, SupplierError):
            raise self.result
        return self.result


@pytest.fixture
async def make_client() -> AsyncIterator[Any]:
    clients: list[httpx.AsyncClient] = []

    def make(supplier: Supplier, authed: bool = True) -> httpx.AsyncClient:
        app = create_app()
        if authed:
            app.dependency_overrides[current_user] = lambda: User(id=0, login="test")
        app.dependency_overrides[get_suppliers] = lambda: {supplier.code: supplier}
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def test_orders_ok(make_client: Any) -> None:
    fake = FakeSupplier(ORDERS)
    r = await make_client(fake).get("/api/suppliers/fake/orders?start=2026-07-22&end=2026-10-22")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["status"] == "ok"
    assert body["data"]["truncated"] is False
    order = body["data"]["orders"][0]
    assert order["total"] == "1191.00"
    assert order["created_at"] in ("2026-10-18T11:35:45Z", "2026-10-18T11:35:45+00:00")
    assert order["delivery_date"] == "2026-10-19"
    assert order["parts"][0]["price"] == "213.00"
    assert order["parts"][0]["status_code"] == 2
    assert fake.calls == [(date(2026, 7, 22), date(2026, 10, 22), None)]


async def test_orders_by_id(make_client: Any) -> None:
    fake = FakeSupplier(ORDERS)
    r = await make_client(fake).get("/api/suppliers/fake/orders?order_id=100000001")
    assert r.status_code == 200
    assert fake.calls == [(None, None, 100000001)]


async def test_supplier_error_is_200(make_client: Any) -> None:
    c = make_client(FakeSupplier(SupplierError("Росско недоступен")))
    r = await c.get("/api/suppliers/fake/orders?order_id=1")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "error"
    assert body["message"] == "Росско недоступен"
    assert body["data"] is None


async def test_unknown_supplier_404(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS)).get("/api/suppliers/nope/orders?order_id=1")
    assert r.status_code == 404


async def test_supplier_without_orders_404(make_client: Any) -> None:
    r = await make_client(SearchOnlySupplier()).get("/api/suppliers/fake/orders?order_id=1")
    assert r.status_code == 404
    assert "Поставщик не поддерживает заказы" in r.text


async def test_no_params_422(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS)).get("/api/suppliers/fake/orders")
    assert r.status_code == 422
    assert "Укажите период или номер заказа" in r.text


async def test_only_start_422(make_client: Any) -> None:
    fake = FakeSupplier(ORDERS)
    r = await make_client(fake).get("/api/suppliers/fake/orders?start=2026-07-22")
    assert r.status_code == 422
    assert fake.calls == []


async def test_start_after_end_422(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS)).get(
        "/api/suppliers/fake/orders?start=2026-10-22&end=2026-07-22"
    )
    assert r.status_code == 422


async def test_period_and_id_422(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS)).get(
        "/api/suppliers/fake/orders?start=2026-07-22&end=2026-10-22&order_id=5"
    )
    assert r.status_code == 422
    assert "Укажите либо период, либо номер заказа" in r.text


async def test_zero_order_id_422(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS)).get("/api/suppliers/fake/orders?order_id=0")
    assert r.status_code == 422


async def test_requires_login_401(make_client: Any) -> None:
    r = await make_client(FakeSupplier(ORDERS), authed=False).get(
        "/api/suppliers/fake/orders?order_id=1"
    )
    assert r.status_code == 401
