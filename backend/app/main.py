from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health
from app.core.config import get_settings
from app.core.db import engine
from app.core.middleware import JsonOnlyMiddleware, NoStoreMiddleware
from app.services.errors import DomainError

LOCAL_FRONTEND_ORIGIN = "http://localhost:5173"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="avto_app", lifespan=lifespan)
    # Last added runs first: CORS -> no-store -> JSON-only -> routes.
    app.add_middleware(JsonOnlyMiddleware)
    app.add_middleware(NoStoreMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[*settings.cors_origins, LOCAL_FRONTEND_ORIGIN],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"message": exc.message})

    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
