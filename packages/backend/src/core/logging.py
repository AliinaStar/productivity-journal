"""Structured logging configuration.

Console renderer in development, JSON in production. When ``LOG_FILE`` is set,
logs are appended to that file; otherwise they go to stdout (captured by Docker).
"""

import logging
from pathlib import Path

import structlog

from src.core.settings import get_settings


def setup_logging() -> None:
    """Configure structlog with a console or JSON renderer based on the environment."""
    settings = get_settings()
    is_dev = settings.app_env == "development"

    if settings.log_file:
        log_path = Path(settings.log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        # Append; keep the handle open for the process lifetime.
        logger_factory = structlog.WriteLoggerFactory(
            file=log_path.open("a", encoding="utf-8")
        )
    else:
        logger_factory = structlog.PrintLoggerFactory()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if is_dev
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=logger_factory,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for the given module name."""
    return structlog.get_logger(name)  # type: ignore[no-any-return]
