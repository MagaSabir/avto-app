from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

JSON_ONLY_METHODS = frozenset({"POST", "PATCH", "DELETE"})


class NoStoreMiddleware:
    """Adds Cache-Control: no-store to every HTTP response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_no_store(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["cache-control"] = "no-store"
            await send(message)

        await self.app(scope, receive, send_with_no_store)


class JsonOnlyMiddleware:
    """Rejects state-changing requests whose body is not declared as JSON."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in JSON_ONLY_METHODS:
            content_type = Headers(scope=scope).get("content-type", "")
            media_type = content_type.split(";", 1)[0].strip().lower()
            if media_type != "application/json":
                response = JSONResponse(
                    status_code=415, content={"detail": "Content-Type must be application/json"}
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
