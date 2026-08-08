"""SerenaPsi API — application entrypoint."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestIdMiddleware, TenantIsolationMiddleware
from app.infrastructure.db.session import engine

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("serenapsi_api_starting", version=settings.app_version, env=settings.environment)
    yield
    await engine.dispose()
    logger.info("serenapsi_api_stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    default_response_class=JSONResponse,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if not settings.is_production else settings.cors_origins_list,
    allow_origin_regex=r".*" if not settings.is_production else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(TenantIsolationMiddleware)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["ops"])
async def health(request: Request) -> dict[str, str]:
    return {
        "status": "ok",
        "service": "serenapsi-api",
        "version": settings.app_version,
        "request_id": getattr(request.state, "request_id", ""),
    }
