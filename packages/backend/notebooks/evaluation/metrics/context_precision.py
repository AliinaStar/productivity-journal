"""Context precision metric: LLM judge rates each chunk's usefulness for the report."""

import json
from typing import Any, Optional

from langchain_openai import ChatOpenAI

from notebooks.evaluation.prompts.precision import PRECISION_PROMPT
from notebooks.evaluation.schemas import RetrievedChunk


async def calculate_context_precision(
    chunks: list[RetrievedChunk],
    current_summary: str,
    llm: ChatOpenAI,
    trace: Optional[Any] = None,
) -> float:
    """LLM-judge context precision via Mean Graded Relevance.

    Each chunk is scored 0-2 by LLM judge (all chunks in parallel).
    MGR = sum(scores) / (n_chunks * max_score).

    Args:
        chunks: List of retrieved chunks to evaluate.
        current_summary: Generated period summary as report context.
        llm: LangChain LLM client.
        trace: Optional Langfuse trace for logging.

    Returns:
        MGR score in [0, 1].

    Raises:
        ValueError: If fewer than 2 chunks are provided.
    """
    import asyncio

    if len(chunks) < 2:
        raise ValueError("context_precision requires at least 2 chunks")

    async def score_chunk(chunk: RetrievedChunk) -> int | None:
        try:
            prompt = PRECISION_PROMPT.format(
                current_summary=current_summary,
                chunk_text=chunk.text,
            )
            response = await llm.ainvoke(prompt)
            return json.loads(response.content)["score"]
        except Exception:
            return None

    raw = await asyncio.gather(*[score_chunk(c) for c in chunks])
    scores = [s for s in raw if s is not None]

    if not scores:
        return 0.0

    result = sum(scores) / (len(chunks) * 2)

    if trace:
        trace.score(name="context_precision", value=result)

    return result
