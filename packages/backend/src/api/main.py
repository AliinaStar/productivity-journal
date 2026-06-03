"""FastAPI application factory.

Wires together:
  - lifespan (APScheduler start / shutdown)
  - routers  (health, auth, reports)
  - CORS middleware
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.logging import get_logger, setup_logging
from src.core.ratelimit import limiter
from src.core.settings import get_settings
from src.db.session import get_async_sessionmaker
from src.rag.scheduler import register_jobs, scheduler
from src.routes.auth import router as auth_router
from src.routes.entries import router as entries_router
from src.routes.goals import router as goals_router
from src.routes.health import router as health_router
from src.routes.reports import router as reports_router
from src.routes.users import router as users_router

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Start the APScheduler on startup and shut it down on teardown.

    Also registers all cron jobs before starting so ``register_jobs``
    is called exactly once per process lifetime.
    """
    register_jobs()
    scheduler.start()
    yield
    scheduler.shutdown()


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application.

    Returns a fully configured ``FastAPI`` instance ready to be served
    by uvicorn. Import this function in ``src/main.py``::

        from src.api.main import create_app
        app = create_app()
    """
    setup_logging()
    settings = get_settings()

    app = FastAPI(
        title="Litopys Report API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.async_session = get_async_sessionmaker()

    # Rate limiting (slowapi)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # Never leak internal error details to clients; log them server-side instead.
    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=exc,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error."},
        )

    # Security headers. TLS itself is terminated by the reverse proxy (see
    # README) — HSTS is only advertised outside development.
    is_production = settings.app_env != "development"

    async def _security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        if is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    app.add_middleware(BaseHTTPMiddleware, dispatch=_security_headers)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(goals_router)
    app.include_router(entries_router)
    app.include_router(reports_router)
    app.include_router(users_router)

    return app
