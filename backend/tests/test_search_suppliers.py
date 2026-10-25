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
from app.suppliers.base import Offer, PartGroup, Supplier, SupplierError, SupplierResult

MSK = timezone(timedelta(hours=3))


class FakeSupplier:
    code = "fake"
    title = "Фейк"

    def __init__(self, result: SupplierResult | SupplierError) -> None:
        self.result = result
        self.with_orders_seen: list[bool] = []

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        self.with_orders_seen.append(with_orders)
        if isinstance(self.result, SupplierError):
            raise self.result
        return self.result


def _offer(price: str = "412.00") -> Offer:
    return Offer(
        warehouse="Склад",
        stock_id="HST1",
        qty=5,
        multiplicity=1,
        delivery_days=2,
        delivery_from=datetime(2026, 10, 23, 12, 0, tzinfo=MSK),
        delivery_to=datetime(2026, 10, 24, 12, 0, tzinfo=MSK),
        kind="normal",
        kind_code="",
        purchase_price=Decimal(price),
    )


def _group(brand: str, number: str, norm: str, requested: bool) -> PartGroup:
    return PartGroup(
        brand=brand,
        number=number,
        number_norm=norm,
        name="Фильтр",
        is_requested=requested,
        offers=[_offer()],
        key=f"{brand.upper()}|{norm}",
        analog_of=[] if requested else ["MANN|W683"],
    )


def _result() -> SupplierResult:
    return SupplierResult(
        groups=[
            _group("Mann", "W 68/3", "W683", True),
            _group("Metelli", "24-0683", "240683", False),
        ],
        message=None,
    )


@pytest.fixture
async def make_client(db_session: AsyncSession) -> AsyncIterator[Any]:
    clients: list[httpx.AsyncClient] = []

    def make(supplier: Supplier) -> httpx.AsyncClient:
        app = create_app()

        async def override_get_session() -> AsyncIterator[AsyncSession]:
            yield db_session

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[current_user] = lambda: User(id=0, login="test")
        app.dependency_overrides[get_suppliers] = lambda: {supplier.code: supplier}
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def _receive(c: httpx.AsyncClient, number: str, brand: str) -> None:
    r = await c.post(
        "/api/stock/receipts",
        json={
            "number": number,
            "brand": brand,
            "name": "Деталь",
            "qty": 2,
            "purchase_price": "412.00",
            "markup": "30",
            "sale_price": "540",
            "supplier": None,
        },
    )
    assert r.status_code == 201


async def test_list_suppliers(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers")
    assert r.status_code == 200
    assert r.json() == [{"code": "fake", "title": "Фейк"}]


async def test_prices_use_global_markup(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["markup"] == "30.00"
    offer = data["groups"][0]["offers"][0]
    assert offer["stock_id"] == "HST1"
    assert offer["purchase_price"] == "412.00"
    assert offer["price"] == "540.00"
    assert r.headers["cache-control"] == "no-store"


async def test_stock_matches_by_analog_number_ignoring_brand(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    await _receive(c, "24-0683", "METELLI")
    await _receive(c, "W 68/3", "MANN-FILTER")
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    (match,) = r.json()["stock_matches"]
    assert match["brand"] == "METELLI"
    assert match["number_norm"] == "240683"
    assert match["sold_30d"] == 0


async def test_stock_match_not_duplicated_with_requested(make_client: Any) -> None:
    res = SupplierResult(
        groups=[
            _group("Mann", "W 68/3", "W683", True),
            _group("Other", "W683", "W683", False),
        ],
        message=None,
    )
    c = make_client(FakeSupplier(res))
    await _receive(c, "W 68/3", "MANN-FILTER")
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    assert r.json()["stock_matches"] == []


async def test_supplier_error_is_200(make_client: Any) -> None:
    c = make_client(FakeSupplier(SupplierError("Росско не ответил за 15 с")))
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "error"
    assert data["message"] == "Росско не ответил за 15 с"
    assert data["groups"] == []
    assert data["stock_matches"] == []


async def test_unknown_supplier_404(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers/nope", params={"q": "W68/3"})
    assert r.status_code == 404
    assert r.json() == {"message": "Поставщик не найден"}


async def test_empty_number_422(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers/fake", params={"q": "-/."})
    assert r.status_code == 422
    assert r.json() == {"message": "Введите номер"}


async def test_delivery_times_are_aware(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    offer = r.json()["groups"][0]["offers"][0]
    assert offer["delivery_from"].endswith("+03:00")


async def test_group_key_and_analog_of_in_api(make_client: Any) -> None:
    client = make_client(FakeSupplier(_result()))
    response = await client.get("/api/search/suppliers/fake", params={"q": "W683"})
    groups = {g["key"]: g for g in response.json()["groups"]}
    assert groups["MANN|W683"]["analog_of"] == []
    assert groups["METELLI|240683"]["analog_of"] == ["MANN|W683"]


async def test_with_orders_reaches_supplier(make_client: Any) -> None:
    supplier = FakeSupplier(_result())
    c = make_client(supplier)
    await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    await c.get("/api/search/suppliers/fake", params={"q": "W68/3", "with_orders": "true"})
    assert supplier.with_orders_seen == [False, True]


async def test_offer_has_new_fields_with_defaults(make_client: Any) -> None:
    c = make_client(FakeSupplier(_result()))
    r = await c.get("/api/search/suppliers/fake", params={"q": "W68/3"})
    offer = r.json()["groups"][0]["offers"][0]
    assert offer["qty_plus"] is False
    assert offer["delivery_days_max"] is None
    assert offer["rating"] is None
    assert offer["order_code"] is None
