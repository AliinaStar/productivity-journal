"""FastAPI application factory.

Wires together:
  - lifespan (APScheduler start / shutdown)
  - routers  (health, auth, reports)
  - CORS middleware
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.settings import get_settings
from src.db.session import get_async_sessionmaker
from src.rag.scheduler import register_jobs, scheduler
from src.routes.auth import router as auth_router
from src.routes.entries import router as entries_router
from src.routes.goals import router as goals_router
from src.routes.health import router as health_router
from src.routes.reports import router as reports_router
from src.routes.users import router as users_router


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
    settings = get_settings()

    app = FastAPI(
        title="BCR Report API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.async_session = get_async_sessionmaker()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(goals_router)
    app.include_router(entries_router)
    app.include_router(reports_router)
    app.include_router(users_router)

    return app
