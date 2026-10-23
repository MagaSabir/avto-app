import logging
from datetime import date
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree

import httpx
import pytest
import respx

from app.suppliers.base import CartLine, SupplierError
from app.suppliers.ratelimit import RateLimiter
from app.suppliers.rossko import ORDERS_LIMIT, URL, URL_ORDERS, URL_SETTLEMENTS, RosskoSupplier

FIXTURE = Path(__file__).parent.parent / "fixtures" / "rossko_search_w683.xml"
SECRETS = ("SECRET1", "SECRET2")


def make(limiter: RateLimiter | None = None, key1: str = "SECRET1", key2: str = "SECRET2"):
    return RosskoSupplier(key1, key2, "000000002", "171801", limiter=limiter)


@pytest.fixture(autouse=True)
def _capture_logs(caplog: pytest.LogCaptureFixture) -> None:
    # alembic's fileConfig (run by the DB fixtures) disables pre-existing loggers
    logging.getLogger("app.suppliers").disabled = False
    caplog.set_level(logging.INFO, logger="app.suppliers")


def assert_clean(message: str, caplog: pytest.LogCaptureFixture) -> None:
    records = [r for r in caplog.records if r.name == "app.suppliers"]
    assert records, "no app.suppliers log record captured"
    for secret in SECRETS:
        assert secret not in message
        assert secret not in caplog.text


def last_log(caplog: pytest.LogCaptureFixture) -> str:
    return [r for r in caplog.records if r.name == "app.suppliers"][-1].getMessage()


@respx.mock
async def test_search_sends_soap_request(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    result = await make().search("W68/3")
    request = route.calls.last.request
    body = request.content.decode()
    assert "<r:text>W68/3</r:text>" in body
    assert "<r:delivery_id>000000002</r:delivery_id>" in body
    assert "<r:address_id>171801</r:address_id>" in body
    assert 'xmlns:r="https://api.rossko.ru/"' in body
    assert request.headers["Content-Type"] == "text/xml; charset=utf-8"
    assert request.headers["SOAPAction"] == '"https://api.rossko.ru/GetSearch"'
    assert "<r:KEY1>SECRET1</r:KEY1>" in body
    assert "<r:KEY2>SECRET2</r:KEY2>" in body
    assert sum(g.is_requested for g in result.groups) == 2
    assert_clean("", caplog)
    line = last_log(caplog)
    assert "supplier=rossko" in line
    assert "number='W68/3'" in line
    assert "outcome=ok" in line
    assert "duration_ms=" in line


@respx.mock
async def test_pickup_omits_address() -> None:
    route = respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    supplier = RosskoSupplier("SECRET1", "SECRET2", "000000001", "", limiter=None)
    await supplier.search("W68/3")
    body = route.calls.last.request.content.decode()
    assert "<r:delivery_id>000000001</r:delivery_id>" in body
    assert "address_id" not in body
    ElementTree.fromstring(body)


@respx.mock
async def test_number_is_xml_escaped() -> None:
    route = respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    await make().search("A&B<1>")
    body = route.calls.last.request.content.decode()
    assert "A&amp;B&lt;1&gt;" in body
    ElementTree.fromstring(body)


@respx.mock
async def test_timeout(caplog: pytest.LogCaptureFixture) -> None:
    respx.post(URL).mock(side_effect=httpx.ReadTimeout("t"))
    with pytest.raises(SupplierError) as exc:
        await make().search("X")
    assert exc.value.message == "Росско не ответил за 15 с"
    assert_clean(exc.value.message, caplog)
    assert "Росско не ответил за 15 с" in last_log(caplog)


@respx.mock
@pytest.mark.parametrize("effect", [httpx.Response(500), httpx.ConnectError("c")])
async def test_http_error_and_network(
    effect: httpx.Response | Exception, caplog: pytest.LogCaptureFixture
) -> None:
    respx.post(URL).mock(side_effect=[effect])
    with pytest.raises(SupplierError) as exc:
        await make().search("X")
    assert exc.value.message == "Росско недоступен, повторите позже"
    assert_clean(exc.value.message, caplog)


@respx.mock
async def test_not_configured(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    with pytest.raises(SupplierError) as exc:
        await make(key1="", key2="").search("X")
    assert exc.value.message == "Росско не настроен"
    assert route.called is False
    assert_clean(exc.value.message, caplog)


@respx.mock
async def test_rate_limit(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    supplier = make(limiter=RateLimiter(1, 60))
    await supplier.search("X")
    with pytest.raises(SupplierError) as exc:
        await supplier.search("X")
    assert exc.value.message == "Лимит запросов к Росско, повторите через минуту"
    assert route.call_count == 1
    assert_clean(exc.value.message, caplog)


SETTLEMENTS = Path(__file__).parent.parent / "fixtures" / "rossko_settlements.xml"


@respx.mock
async def test_settlements_sends_soap_request(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL_SETTLEMENTS).respond(200, content=SETTLEMENTS.read_bytes())
    result = await make().settlements(2)
    assert route.call_count == 1
    request = route.calls[0].request
    assert request.headers["SOAPAction"] == '"https://api.rossko.ru/GetSettlements"'
    body = ElementTree.fromstring(request.content)
    ns = "{https://api.rossko.ru/}"
    call = body.find(f".//{ns}GetSettlements")
    assert call is not None
    assert call.findtext(f"{ns}KEY1") == "SECRET1"
    # Rossko counts offset in documents, not pages (checked on the live API)
    assert call.findtext(f"{ns}offset") == "40"
    assert result.balance == Decimal("-1250.40")
    message = last_log(caplog)
    assert "method=settlements" in message
    assert "page=2" in message
    assert "outcome=ok" in message
    assert_clean(message, caplog)


@respx.mock
async def test_settlements_timeout(caplog: pytest.LogCaptureFixture) -> None:
    respx.post(URL_SETTLEMENTS).mock(side_effect=httpx.ReadTimeout("t"))
    with pytest.raises(SupplierError) as exc:
        await make().settlements(0)
    assert exc.value.message == "Росско не ответил за 15 с"
    assert_clean(exc.value.message, caplog)


@respx.mock
@pytest.mark.parametrize("effect", [httpx.Response(500), httpx.ConnectError("c")])
async def test_settlements_http_error(
    effect: httpx.Response | Exception, caplog: pytest.LogCaptureFixture
) -> None:
    respx.post(URL_SETTLEMENTS).mock(side_effect=[effect])
    with pytest.raises(SupplierError) as exc:
        await make().settlements(0)
    assert exc.value.message == "Росско недоступен, повторите позже"
    assert_clean(exc.value.message, caplog)


@respx.mock
async def test_settlements_not_configured(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL_SETTLEMENTS).respond(200, content=SETTLEMENTS.read_bytes())
    with pytest.raises(SupplierError) as exc:
        await make(key1="", key2="").settlements(0)
    assert exc.value.message == "Росско не настроен"
    assert route.called is False


@respx.mock
async def test_settlements_rate_limited_shares_search_limit(
    caplog: pytest.LogCaptureFixture,
) -> None:
    respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    route = respx.post(URL_SETTLEMENTS).respond(200, content=SETTLEMENTS.read_bytes())
    supplier = make(limiter=RateLimiter(1, 60))
    await supplier.search("X")
    with pytest.raises(SupplierError) as exc:
        await supplier.settlements(0)
    assert exc.value.message == "Лимит запросов к Росско, повторите через минуту"
    assert route.called is False


@respx.mock
async def test_settlements_sends_filters() -> None:
    route = respx.post(URL_SETTLEMENTS).respond(200, content=SETTLEMENTS.read_bytes())
    await make().settlements(0, status="Оплачено", start=date(2026, 10, 1), end=date(2026, 10, 22))
    ns = "{https://api.rossko.ru/}"
    call = ElementTree.fromstring(route.calls[0].request.content).find(f".//{ns}GetSettlements")
    assert call is not None
    assert call.findtext(f"{ns}status") == "Оплачено"
    assert call.findtext(f"{ns}startDate") == "2026-10-01"
    assert call.findtext(f"{ns}endDate") == "2026-10-22"


@respx.mock
async def test_settlements_without_filters_sends_no_filter_tags() -> None:
    route = respx.post(URL_SETTLEMENTS).respond(200, content=SETTLEMENTS.read_bytes())
    await make().settlements(0)
    body = route.calls[0].request.content
    assert b"status" not in body
    assert b"startDate" not in body
    assert b"endDate" not in body


ORDERS = Path(__file__).parent.parent / "fixtures" / "rossko_orders.xml"


@respx.mock
async def test_orders_sends_period(caplog: pytest.LogCaptureFixture) -> None:
    route = respx.post(URL_ORDERS).respond(200, content=ORDERS.read_bytes())
    result = await make().orders(start=date(2026, 7, 22), end=date(2026, 10, 22))
    request = route.calls[0].request
    assert request.headers["SOAPAction"] == '"https://api.rossko.ru/GetOrders"'
    body = request.content.decode()
    assert "<r:limit>500</r:limit>" in body
    assert "<r:start_date>2026-07-22</r:start_date>" in body
    assert "<r:end_date>2026-10-22</r:end_date>" in body
    assert "<r:KEY1>SECRET1</r:KEY1>" in body
    assert "<r:KEY2>SECRET2</r:KEY2>" in body
    assert "order_ids" not in body
    assert len(result.orders) == 2
    assert result.truncated is False
    message = last_log(caplog)
    assert "method=orders" in message
    assert "outcome=ok" in message
    assert "100000001" not in message
    assert_clean(message, caplog)


@respx.mock
async def test_orders_by_id() -> None:
    route = respx.post(URL_ORDERS).respond(200, content=ORDERS.read_bytes())
    await make().orders(order_id=100000001)
    body = route.calls[0].request.content.decode()
    assert "<r:order_ids><r:id>100000001</r:id></r:order_ids>" in body
    assert "start_date" not in body


@respx.mock
async def test_orders_truncated() -> None:
    text = ORDERS.read_text()
    start = text.index("<ns1:Order>")
    end = text.index("</ns1:OrdersList>")
    first = text[start : text.index("</ns1:Order>") + len("</ns1:Order>")]
    xml = text[:start] + first * ORDERS_LIMIT + text[end:]
    respx.post(URL_ORDERS).respond(200, content=xml.encode())
    result = await make().orders(start=date(2026, 7, 22), end=date(2026, 10, 22))
    assert len(result.orders) == ORDERS_LIMIT
    assert result.truncated is True


@respx.mock
async def test_orders_timeout(caplog: pytest.LogCaptureFixture) -> None:
    respx.post(URL_ORDERS).mock(side_effect=httpx.ReadTimeout("t"))
    with pytest.raises(SupplierError) as exc:
        await make().orders()
    assert exc.value.message == "Росско не ответил за 15 с"
    assert_clean(exc.value.message, caplog)


@respx.mock
@pytest.mark.parametrize("effect", [httpx.Response(500), httpx.ConnectError("c")])
async def test_orders_http_error(
    effect: httpx.Response | Exception, caplog: pytest.LogCaptureFixture
) -> None:
    respx.post(URL_ORDERS).mock(side_effect=[effect])
    with pytest.raises(SupplierError) as exc:
        await make().orders()
    assert exc.value.message == "Росско недоступен, повторите позже"
    assert_clean(exc.value.message, caplog)


@respx.mock
async def test_orders_not_configured() -> None:
    route = respx.post(URL_ORDERS).respond(200, content=ORDERS.read_bytes())
    with pytest.raises(SupplierError) as exc:
        await make(key1="", key2="").orders()
    assert exc.value.message == "Росско не настроен"
    assert route.called is False


@respx.mock
async def test_orders_rate_limited_shares_search_limit() -> None:
    respx.post(URL).respond(200, content=FIXTURE.read_bytes())
    route = respx.post(URL_ORDERS).respond(200, content=ORDERS.read_bytes())
    supplier = make(limiter=RateLimiter(1, 60))
    await supplier.search("X")
    with pytest.raises(SupplierError) as exc:
        await supplier.orders()
    assert exc.value.message == "Лимит запросов к Росско, повторите через минуту"
    assert route.called is False


@respx.mock
async def test_check_offers_finds_offer_and_missing_stock_id() -> None:
    fixture = Path(__file__).parent.parent / "fixtures" / "rossko_search_333114.xml"
    route = respx.post(URL).respond(200, content=fixture.read_bytes())
    lines = [
        CartLine("HST1498810258", "Kyb", "333-114", None),
        CartLine("HST1490428513", "KYB", "333114", None),
        CartLine("NOPE", "KYB", "333114", None),
    ]
    found = await make().check_offers(lines)
    assert route.call_count == 1
    offer = found["HST1498810258"]
    assert offer is not None
    assert offer.purchase_price == Decimal("6802")
    assert found["HST1490428513"] is not None
    assert found["NOPE"] is None
