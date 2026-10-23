import logging
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest
import respx

from app.suppliers.base import SupplierError
from app.suppliers.mikado import URL, DailyLimit, MikadoSupplier
from app.suppliers.ratelimit import RateLimiter

FIXTURES = Path(__file__).parent.parent / "fixtures"
SEARCH = URL.format(method="Code_Search")
INFO = URL.format(method="Code_Info")
STOCK = URL.format(method="CodeBrandStockInfo")


def fixture(name: str) -> bytes:
    return (FIXTURES / f"mikado_{name}.xml").read_bytes()


def make(**kwargs):
    return MikadoSupplier("CLIENT1", "SECRET1", **kwargs)


def form(route) -> dict[str, list[str]]:
    return parse_qs(route.calls.last.request.content.decode())


@pytest.fixture(autouse=True)
def _capture_logs(caplog: pytest.LogCaptureFixture) -> None:
    logging.getLogger("app.suppliers").disabled = False
    caplog.set_level(logging.INFO, logger="app.suppliers")


@respx.mock
async def test_search_sends_form_stock_only() -> None:
    route = respx.post(SEARCH).respond(200, content=fixture("search_stock"))
    result = await make().search("W68/3")
    assert form(route) == {
        "Search_Code": ["W68/3"],
        "ClientID": ["CLIENT1"],
        "Password": ["SECRET1"],
        "FromStockOnly": ["FromStockOnly"],
    }
    assert "MANN|W683" in {g.key for g in result.groups}


@respx.mock
async def test_search_with_orders() -> None:
    route = respx.post(SEARCH).respond(200, content=fixture("search_orders"))
    await make().search("W683", with_orders=True)
    assert form(route)["FromStockOnly"] == ["FromStockAndByOrder"]


@respx.mock
async def test_timeout() -> None:
    respx.post(SEARCH).mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(SupplierError) as exc:
        await make().search("W683")
    assert exc.value.message == "Микадо не ответил за 15 с"


@respx.mock
async def test_http_error() -> None:
    respx.post(SEARCH).respond(500)
    with pytest.raises(SupplierError) as exc:
        await make().search("W683")
    assert exc.value.message == "Микадо недоступен, повторите позже"


@respx.mock
@pytest.mark.parametrize("client_id,password", [("", "x"), ("x", ""), ("", "")])
async def test_not_configured(client_id: str, password: str) -> None:
    route = respx.post(SEARCH)
    with pytest.raises(SupplierError) as exc:
        await MikadoSupplier(client_id, password).search("W683")
    assert exc.value.message == "Микадо не настроен"
    assert not route.called


@respx.mock
async def test_variants_sends_form() -> None:
    route = respx.post(INFO).respond(200, content=fixture("info_order"))
    result = await make().variants("V1004-W683")
    assert form(route) == {
        "ZakazCode": ["V1004-W683"],
        "ClientID": ["CLIENT1"],
        "Password": ["SECRET1"],
    }
    assert result.offers


@respx.mock
async def test_rate_limiter_applies() -> None:
    respx.post(SEARCH).respond(200, content=fixture("search_stock"))
    supplier = make(limiter=RateLimiter(1, 60))
    await supplier.search("W683")
    with pytest.raises(SupplierError):
        await supplier.search("W683")


def test_daily_limit_resets_on_moscow_date() -> None:
    now = [datetime(2026, 10, 23, 20, 59, tzinfo=UTC)]
    daily = DailyLimit(1, clock=lambda: now[0])
    assert daily.try_acquire()
    assert not daily.try_acquire()
    now[0] = datetime(2026, 10, 23, 21, 1, tzinfo=UTC)  # 00:01 MSK next day
    assert daily.try_acquire()


@respx.mock
async def test_daily_limit_spent_by_search_and_info_not_by_stock_info() -> None:
    respx.post(SEARCH).respond(200, content=fixture("search_stock"))
    respx.post(INFO).respond(200, content=fixture("info_order"))
    stock = respx.post(STOCK).respond(200, content=fixture("cbsi"))
    supplier = make(daily=DailyLimit(2))
    for _ in range(3):
        offers = await supplier._stock_info("W683", "MANN")
        assert offers
    assert stock.call_count == 3
    assert form(stock) == {
        "Code": ["W683"],
        "Brand": ["MANN"],
        "ClientID": ["CLIENT1"],
        "Password": ["SECRET1"],
    }
    await supplier.search("W683")
    await supplier.variants("v1004-w683")
    with pytest.raises(SupplierError) as exc:
        await supplier.search("W683")
    assert exc.value.message == "Лимит запросов к Микадо на сегодня исчерпан"
    with pytest.raises(SupplierError):
        await supplier.variants("v1004-w683")
    assert await supplier._stock_info("W683", "MANN")


@respx.mock
async def test_stock_info_auth_error() -> None:
    respx.post(STOCK).respond(200, content=fixture("cbsi_auth_error"))
    with pytest.raises(SupplierError) as exc:
        await make()._stock_info("W683", "MANN")
    assert exc.value.message == "Микадо: ошибка авторизации"


@respx.mock
async def test_password_not_logged(caplog: pytest.LogCaptureFixture) -> None:
    respx.post(SEARCH).respond(200, content=fixture("search_stock"))
    respx.post(INFO).respond(500)
    supplier = make()
    await supplier.search("W683")
    with pytest.raises(SupplierError):
        await supplier.variants("x")
    records = [r for r in caplog.records if r.name == "app.suppliers"]
    assert len(records) == 2
    assert "SECRET1" not in caplog.text
    assert "method=Code_Search" in records[0].getMessage()
    assert "outcome=ok" in records[0].getMessage()


@respx.mock
async def test_fake_mode_makes_no_http() -> None:
    routes = [respx.post(u) for u in (SEARCH, INFO, STOCK)]
    supplier = MikadoSupplier("", "", fake=True)
    stock_only = await supplier.search("W683")
    with_orders = await supplier.search("W683", with_orders=True)
    variants = await supplier.variants("gto90915yzzm3")
    offers = await supplier._stock_info("W683", "MANN")
    assert "MANN|W683" in {g.key for g in stock_only.groups}
    assert [g.key for g in with_orders.groups] != [g.key for g in stock_only.groups]
    assert variants.offers
    assert offers
    assert not any(r.called for r in routes)
