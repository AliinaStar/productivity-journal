"""Langfuse observability setup.

Provides a shared Langfuse client and a LangChain callback handler
that can be injected into any LLM call to enable automatic tracing.

Usage in a node::

    from src.core.observability import get_langfuse_handler

    result = await llm.ainvoke(
        messages,
        config={"callbacks": [get_langfuse_handler()]},
    )

Usage around a full pipeline run::

    from src.core.observability import get_langfuse

    with get_langfuse().start_as_current_span(name="report_pipeline") as span:
        state = await app.ainvoke({...})
        span.update(output=state["final_report"])
"""

from functools import lru_cache

from langfuse import Langfuse
from langfuse.callback import CallbackHandler


@lru_cache(maxsize=1)
def get_langfuse() -> Langfuse:
    """Create and cache a Langfuse client from ``AppSettings``.

    Reads ``langfuse_public_key``, ``langfuse_secret_key``, and
    ``langfuse_base_url`` from settings. Returns the same instance
    for the lifetime of the process.
    """
    raise NotImplementedError


def get_langfuse_handler() -> CallbackHandler:
    """Return a fresh LangChain ``CallbackHandler`` backed by the shared client.

    A new handler instance per call is intentional — each handler carries
    its own trace context so concurrent pipeline runs do not mix traces.
    """
    raise NotImplementedError
