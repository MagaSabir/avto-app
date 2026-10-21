import logging
from pathlib import Path
from xml.etree import ElementTree

import httpx
import pytest
import respx

from app.suppliers.base import SupplierError
from app.suppliers.ratelimit import RateLimiter
from app.suppliers.rossko import URL, RosskoSupplier

FIXTURE = Path(__file__).parent.parent / "fixtures" / "rossko_search_w683.xml"
SECRETS = ("SECRET1", "SECRET2")


def make(limiter: RateLimiter | None = None, key1: str = "SECRET1", key2: str = "SECRET2"):
    return RosskoSupplier(key1, key2, "000000002", "171801", limiter=limiter)


def assert_clean(message: str, caplog: pytest.LogCaptureFixture) -> None:
    for secret in SECRETS:
        assert secret not in message
        assert secret not in caplog.text


@respx.mock
async def test_search_sends_soap_request(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="app.suppliers")
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
    assert sum(g.is_requested for g in result.groups) == 2
    assert_clean("", caplog)


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
