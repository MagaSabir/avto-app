import logging

PRIVATE_PREFIX = "/api/customers"


class AccessLogFilter(logging.Filter):
    """Drop the query string of customer routes from uvicorn access lines."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            path = args[2]
            if path.startswith(PRIVATE_PREFIX) and "?" in path:
                record.args = (*args[:2], path.split("?", 1)[0] + "?<hidden>", *args[3:])
        return True


def install_access_log_filter() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, AccessLogFilter) for f in logger.filters):
        logger.addFilter(AccessLogFilter())
