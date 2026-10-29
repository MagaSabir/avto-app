import logging

from app.core.logging import AccessLogFilter


def _record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:1234", "GET", path, "1.1", 200),
        None,
    )


def test_masks_query_of_customers_paths() -> None:
    rec = _record("/api/customers?q=Иван%20Тест")
    assert AccessLogFilter().filter(rec) is True
    assert "q=" not in rec.getMessage()
    assert "/api/customers" in rec.getMessage()
    assert "200" in rec.getMessage()


def test_keeps_other_paths() -> None:
    rec = _record("/api/stock?q=abc")
    assert AccessLogFilter().filter(rec) is True
    assert "/api/stock?q=abc" in rec.getMessage()
