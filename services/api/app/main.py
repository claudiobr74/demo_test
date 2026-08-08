"""SerenaPsi API — application entrypoint (+ Flutter web em desenvolvimento)."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestIdMiddleware, TenantIsolationMiddleware
from app.infrastructure.db.session import engine

logger = get_logger(__name__)

# services/api/app/main.py → /workspace
_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
_WEB_DIR = _WORKSPACE_ROOT / "apps" / "mobile" / "build" / "web"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info(
        "serenapsi_api_starting",
        version=settings.app_version,
        env=settings.environment,
        web_dir=str(_WEB_DIR) if _WEB_DIR.is_dir() else None,
    )
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


class _NoCacheWebAssetsMiddleware(BaseHTTPMiddleware):
    """Evita service worker / browser cache servir build Flutter antigo em dev."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response: Response = await call_next(request)
        path = request.url.path
        if path == "/" or path.endswith(
            (".html", ".js", ".json", "flutter_service_worker.js", "flutter_bootstrap.js")
        ):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response


app.add_middleware(_NoCacheWebAssetsMiddleware)

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
        "web": "mounted" if _WEB_DIR.is_dir() else "missing",
    }


# App Flutter (build/web) na mesma origem da API — abre só a porta 8000.
if _WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_WEB_DIR), html=True), name="web")
