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
from app.suppliers.base import Settlements, Supplier, SupplierError, SupplierResult
from app.suppliers.rossko import parse_settlements

SETTLEMENTS = parse_settlements(
    (Path(__file__).parent / "fixtures" / "rossko_settlements.xml").read_bytes()
)


class SearchOnlySupplier:
    code = "fake"
    title = "Фейк"

    async def search(self, number: str, with_orders: bool = False) -> SupplierResult:
        return SupplierResult(groups=[], message=None)


class FakeSupplier(SearchOnlySupplier):
    def __init__(self, result: Settlements | SupplierError) -> None:
        self.result = result
        self.pages: list[int] = []
        self.filters: list[tuple[str | None, date | None, date | None]] = []

    async def settlements(
        self,
        page: int,
        status: str | None = None,
        start: date | None = None,
        end: date | None = None,
    ) -> Settlements:
        self.pages.append(page)
        self.filters.append((status, start, end))
        if isinstance(self.result, SupplierError):
            raise self.result
        return self.result


@pytest.fixture
async def make_client() -> AsyncIterator[Any]:
    clients: list[httpx.AsyncClient] = []

    def make(supplier: Supplier) -> httpx.AsyncClient:
        app = create_app()
        app.dependency_overrides[current_user] = lambda: User(id=0, login="test")
        app.dependency_overrides[get_suppliers] = lambda: {supplier.code: supplier}
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def test_settlements_ok(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get("/api/suppliers/fake/settlements")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["code"] == "fake"
    assert body["title"] == "Фейк"
    assert body["status"] == "ok"
    assert body["message"] is None
    data = body["data"]
    assert data["balance"] == "-1250.40"
    assert data["limit"] == "50000.00"
    assert data["payment_delay"] == 14
    assert data["overdue_sum"] == "500.00"
    assert data["payments"][0]["date"] == "2026-10-25"
    assert data["documents_total"] == 41
    assert data["documents"][0]["amount"] == "0.00"
    assert data["documents"][0]["order_id"] is None
    assert data["documents"][0]["date"] in ("2026-10-20T09:15:28Z", "2026-10-20T09:15:28+00:00")
    assert data["documents"][1]["items"][0] == {
        "name": "W 68/3 Фильтр масляный MANN-FILTER",
        "count": 2,
        "price": "412.00",
    }


async def test_settlements_page_passed(make_client: Any) -> None:
    supplier = FakeSupplier(SETTLEMENTS)
    c = make_client(supplier)
    r = await c.get("/api/suppliers/fake/settlements", params={"page": 3})
    assert r.status_code == 200
    assert supplier.pages == [3]


async def test_supplier_error_is_200(make_client: Any) -> None:
    c = make_client(FakeSupplier(SupplierError("Росско не ответил за 15 с")))
    r = await c.get("/api/suppliers/fake/settlements")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "error"
    assert body["message"] == "Росско не ответил за 15 с"
    assert body["data"] is None


async def test_unknown_supplier_404(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get("/api/suppliers/nope/settlements")
    assert r.status_code == 404
    assert r.json() == {"message": "Поставщик не найден"}


async def test_supplier_without_settlements_404(make_client: Any) -> None:
    c = make_client(SearchOnlySupplier())
    r = await c.get("/api/suppliers/fake/settlements")
    assert r.status_code == 404
    assert r.json() == {"message": "Поставщик не поддерживает взаиморасчёты"}


async def test_negative_page_422(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get("/api/suppliers/fake/settlements", params={"page": -1})
    assert r.status_code == 422


async def test_filters_passed(make_client: Any) -> None:
    supplier = FakeSupplier(SETTLEMENTS)
    c = make_client(supplier)
    r = await c.get(
        "/api/suppliers/fake/settlements",
        params={"status": "Оплачено", "start": "2026-10-01", "end": "2026-10-22"},
    )
    assert r.status_code == 200
    assert supplier.filters == [("Оплачено", date(2026, 10, 1), date(2026, 10, 22))]


async def test_no_filters_passed_as_none(make_client: Any) -> None:
    supplier = FakeSupplier(SETTLEMENTS)
    c = make_client(supplier)
    await c.get("/api/suppliers/fake/settlements")
    assert supplier.filters == [(None, None, None)]


async def test_unknown_status_422(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get("/api/suppliers/fake/settlements", params={"status": "Любой"})
    assert r.status_code == 422


async def test_only_start_422(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get("/api/suppliers/fake/settlements", params={"start": "2026-10-01"})
    assert r.status_code == 422
    assert r.json() == {"message": "Укажите обе даты периода"}


async def test_start_after_end_422(make_client: Any) -> None:
    c = make_client(FakeSupplier(SETTLEMENTS))
    r = await c.get(
        "/api/suppliers/fake/settlements", params={"start": "2026-10-22", "end": "2026-10-01"}
    )
    assert r.status_code == 422
    assert r.json() == {"message": "Начало периода позже конца"}
