"""LLM singleton for the report-generation pipeline.

A single ``ChatOpenAI`` instance is shared across all nodes and scheduler
runs within a process lifetime. Keeping it cached avoids re-reading settings
and re-authenticating with the OpenAI API on every invocation.
"""

from functools import lru_cache

from langchain_openai import ChatOpenAI

from src.core.settings import get_settings


@lru_cache(maxsize=1)
def get_llm() -> ChatOpenAI:
    """Create and cache a ``ChatOpenAI`` instance from ``AppSettings``.

    Reads ``openai_api_key`` and ``llm_model`` from settings.
    """
    settings = get_settings()
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        timeout=60,
        max_retries=2,
    )
