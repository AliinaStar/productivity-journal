"""Langfuse observability setup.

Provides a shared Langfuse client and a LangChain callback handler
that can be injected into any LLM call to enable automatic tracing.
"""

from functools import lru_cache

from langfuse import Langfuse
from langfuse.callback import CallbackHandler

from src.core.settings import get_settings


@lru_cache(maxsize=1)
def get_langfuse() -> Langfuse:
    """Create and cache a Langfuse client from ``AppSettings``."""
    settings = get_settings()
    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_base_url,
    )


def get_langfuse_handler() -> CallbackHandler:
    """Return a fresh LangChain ``CallbackHandler`` backed by the shared client.

    A new handler instance per call is intentional — each handler carries
    its own trace context so concurrent pipeline runs do not mix traces.
    """
    settings = get_settings()
    return CallbackHandler(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_base_url,
    )
