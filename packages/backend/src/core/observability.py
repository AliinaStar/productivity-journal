"""Langfuse observability setup (Langfuse v3 / OpenTelemetry SDK).

Privacy invariant — this is a journaling app. The report prompts are built
from users' personal diary entries (see ``create_report`` and ``summarizer``),
so trace inputs and outputs would otherwise carry that text off-box. The
shared client is configured with a global ``mask`` that redacts every
free-text input/output/metadata value before anything is exported. Langfuse
therefore only ever stores non-content signals — token usage, cost, latency,
model, call structure, error status — plus the explicit non-sensitive tags we
attach per trace (period type, internal user id).
"""

from functools import lru_cache
from typing import Any

from langfuse import Langfuse
from langfuse.langchain import CallbackHandler

from src.core.settings import get_settings


def _mask(*, data: Any, **_: Any) -> Any:
    """Redact all free text so no diary content leaves the process.

    Langfuse calls this for every input/output/metadata value it exports
    (signature is keyword-only ``data`` in the v3 SDK). We keep the *shape* —
    a marker with the original length — so a trace still shows "text was here,
    N chars" without the text itself. The numbers we actually care about
    (token usage, latency, cost, model) are tracked on separate observation
    fields that are never routed through here, so they stay intact.
    """
    if isinstance(data, str):
        return f"<redacted:{len(data)}chars>"
    if isinstance(data, dict):
        return {key: _mask(data=value) for key, value in data.items()}
    if isinstance(data, (list, tuple)):
        return [_mask(data=item) for item in data]
    return data


@lru_cache(maxsize=1)
def _client() -> Langfuse | None:
    """Initialise and cache the singleton Langfuse client, or ``None`` when unconfigured.

    Returning ``None`` rather than raising keeps tracing entirely optional:
    development and any deploy without Langfuse keys run untouched. Constructing
    ``Langfuse(...)`` registers the global client that a bare ``CallbackHandler()``
    binds to, so this must run before any handler is created.
    """
    settings = get_settings()
    if not (settings.langfuse_public_key and settings.langfuse_secret_key):
        return None
    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_base_url or None,
        mask=_mask,
    )


def langfuse_enabled() -> bool:
    """True when Langfuse keys are configured."""
    return _client() is not None


def get_langfuse_callbacks() -> list[CallbackHandler]:
    """LangChain callbacks list — empty when Langfuse is unconfigured.

    Lets call sites stay unconditional::

        config={"callbacks": get_langfuse_callbacks(), "metadata": {...}}

    The bare ``CallbackHandler()`` inherits auth from the singleton created in
    ``_client()`` (which ``langfuse_enabled()`` guarantees has run first).
    """
    if not langfuse_enabled():
        return []
    return [CallbackHandler()]


def flush_langfuse() -> None:
    """Flush buffered events. Call on app shutdown so nothing is lost.

    The SDK batches events and exports them asynchronously; without a flush on
    teardown the last batch can be dropped.
    """
    client = _client()
    if client is not None:
        client.flush()
