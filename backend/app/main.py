from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api import auth as auth_api
from app.api import cart as cart_api
from app.api import cash as cash_api
from app.api import customers as customers_api
from app.api import health
from app.api import orders as orders_api
from app.api import search as search_api
from app.api import settings as settings_api
from app.api import settlements as settlements_api
from app.api import stock as stock_api
from app.api.deps import current_user
from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import install_access_log_filter
from app.core.login_limiter import LoginLimiter
from app.core.middleware import JsonOnlyMiddleware, NoStoreMiddleware
from app.services.errors import DomainError

LOCAL_FRONTEND_ORIGIN = "http://localhost:5173"
CONFLICT_MESSAGE = "Конфликт данных: обновите страницу и повторите"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    install_access_log_filter()
    settings = get_settings()
    app = FastAPI(
        title="avto_app",
        lifespan=lifespan,
        docs_url="/docs" if settings.api_docs else None,
        redoc_url="/redoc" if settings.api_docs else None,
        openapi_url="/openapi.json" if settings.api_docs else None,
    )
    app.state.login_limiter = LoginLimiter()
    # Last added runs first: CORS -> no-store -> JSON-only -> routes.
    app.add_middleware(JsonOnlyMiddleware)
    app.add_middleware(NoStoreMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[*settings.cors_origins, LOCAL_FRONTEND_ORIGIN],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
        allow_credentials=True,
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"message": exc.message})

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_request: Request, _exc: IntegrityError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"message": CONFLICT_MESSAGE})

    protected = [Depends(current_user)]
    app.include_router(health.router, prefix="/api")
    app.include_router(auth_api.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api", dependencies=protected)
    app.include_router(stock_api.router, prefix="/api", dependencies=protected)
    app.include_router(search_api.router, prefix="/api", dependencies=protected)
    app.include_router(settlements_api.router, prefix="/api", dependencies=protected)
    app.include_router(orders_api.router, prefix="/api", dependencies=protected)
    app.include_router(cart_api.router, prefix="/api", dependencies=protected)
    app.include_router(cash_api.router, prefix="/api", dependencies=protected)
    app.include_router(customers_api.router, prefix="/api", dependencies=protected)
    return app


app = create_app()
