from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.db import get_session
from app.main import create_app
from app.models.auth import User
from app.suppliers import get_suppliers
from app.suppliers.base import Offer, SupplierError, SupplierResult, SupplierVariants

MSK = timezone(timedelta(hours=3))


class VariantsFake:
    code = "fake"
    title = "Фейк"

    def __init__(self, result: SupplierVariants | SupplierError) -> None:
        self.result = result
        self.seen: list[str] = []

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        return SupplierResult(groups=[], message=None)

    async def variants(self, order_code: str) -> SupplierVariants:
        self.seen.append(order_code)
        if isinstance(self.result, SupplierError):
            raise self.result
        return self.result


class PlainFake:
    code = "plain"
    title = "Простой"

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        return SupplierResult(groups=[], message=None)


def _offer() -> Offer:
    return Offer(
        warehouse="Склад",
        stock_id="HST1",
        qty=5,
        multiplicity=1,
        delivery_days=2,
        delivery_from=datetime(2026, 10, 23, 12, 0, tzinfo=MSK),
        delivery_to=None,
        kind="variants",
        kind_code="",
        purchase_price=Decimal("412.00"),
        order_code="OC1",
    )


@pytest.fixture
async def make_client(db_session: AsyncSession) -> AsyncIterator[Any]:
    clients: list[httpx.AsyncClient] = []

    def make(supplier: Any, auth: bool = True) -> httpx.AsyncClient:
        app = create_app()

        async def override_get_session() -> AsyncIterator[AsyncSession]:
            yield db_session

        app.dependency_overrides[get_session] = override_get_session
        if auth:
            app.dependency_overrides[current_user] = lambda: User(id=0, login="test")
        app.dependency_overrides[get_suppliers] = lambda: {supplier.code: supplier}
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def test_variants_with_markup(make_client: Any) -> None:
    sup = VariantsFake(SupplierVariants(offers=[_offer()], message=None))
    c = make_client(sup)
    r = await c.get("/api/search/suppliers/fake/variants", params={"order_code": "OC1"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["code"] == "fake"
    assert data["markup"] == "30.00"
    (offer,) = data["offers"]
    assert offer["purchase_price"] == "412.00"
    assert offer["price"] == "540.00"
    assert offer["order_code"] == "OC1"
    assert sup.seen == ["OC1"]
    assert r.headers["cache-control"] == "no-store"


async def test_supplier_without_variants_is_404(make_client: Any) -> None:
    c = make_client(PlainFake())
    r = await c.get("/api/search/suppliers/plain/variants", params={"order_code": "OC1"})
    assert r.status_code == 404
    assert r.json()["message"] == "Поставщик не поддерживает варианты поставки"


async def test_unknown_supplier_is_404(make_client: Any) -> None:
    c = make_client(VariantsFake(SupplierVariants(offers=[], message=None)))
    r = await c.get("/api/search/suppliers/nope/variants", params={"order_code": "OC1"})
    assert r.status_code == 404


async def test_empty_order_code_is_422(make_client: Any) -> None:
    c = make_client(VariantsFake(SupplierVariants(offers=[], message=None)))
    r = await c.get("/api/search/suppliers/fake/variants", params={"order_code": "  "})
    assert r.status_code == 422


async def test_supplier_error_returns_error_status(make_client: Any) -> None:
    c = make_client(VariantsFake(SupplierError("Микадо недоступен, повторите позже")))
    r = await c.get("/api/search/suppliers/fake/variants", params={"order_code": "OC1"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "error"
    assert data["message"] == "Микадо недоступен, повторите позже"
    assert data["offers"] == []


async def test_requires_login(make_client: Any) -> None:
    c = make_client(VariantsFake(SupplierVariants(offers=[], message=None)), auth=False)
    r = await c.get("/api/search/suppliers/fake/variants", params={"order_code": "OC1"})
    assert r.status_code == 401
