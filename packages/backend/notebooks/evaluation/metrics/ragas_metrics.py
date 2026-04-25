"""RAGAS faithfulness and answer_relevancy for report generation."""

import json
from typing import Any, Optional

from langchain_openai import ChatOpenAI

from notebooks.evaluation.prompts.answer_relevancy import ANSWER_RELEVANCY_TEMPLATE
from notebooks.evaluation.prompts.faithfulness import (
    FAITHFULNESS_EXTRACT_CLAIMS_TEMPLATE,
    FAITHFULNESS_VERIFY_CLAIM_TEMPLATE,
)
from notebooks.evaluation.schemas import ReportResult, RetrievedContext


def format_context(retrieved_context: RetrievedContext) -> str:
    """Build the context string the faithfulness judge sees.

    source_chunks (raw current entries) are included only when pattern_reports
    are absent — when pattern_reports exist they already represent what the model
    saw as current-period context (sub-period summaries), so raw entries would
    be redundant and misleading.
    """
    parts = []

    if retrieved_context.goal_metrics_block:
        parts.append(f"Goal statistics:\n{retrieved_context.goal_metrics_block}")

    if retrieved_context.source_chunks and not retrieved_context.pattern_reports:
        chunks_text = "\n---\n".join(
            c.text for c in retrieved_context.source_chunks
        )
        parts.append(f"Current period entries:\n{chunks_text}")

    if retrieved_context.moment_chunks:
        chunks_text = "\n---\n".join(
            c.text for c in retrieved_context.moment_chunks
        )
        parts.append(f"Retrieved past entries:\n{chunks_text}")

    if retrieved_context.pattern_reports:
        reports_text = "\n---\n".join(
            r.text for r in retrieved_context.pattern_reports
        )
        parts.append(f"Current period summaries:\n{reports_text}")

    return "\n\n".join(parts) if parts else ""


async def calculate_faithfulness(
    data: ReportResult,
    llm: ChatOpenAI,
    trace: Optional[Any] = None,
) -> float | None:
    """Compute faithfulness via two-step LLM judge.

    Step 1: Extract atomic claims from generated text.
    Step 2: Verify all claims in parallel against the context the model actually saw.
    Score = supported_claims / total_claims.

    Returns:
        Faithfulness score in [0, 1], or None if computation fails.
    """
    import asyncio

    try:
        generated_text = data.generated_text
        retrieved_context = data.context

        if retrieved_context is None:
            return None

        context = format_context(retrieved_context)
        if not context:
            return None

        extract_prompt = FAITHFULNESS_EXTRACT_CLAIMS_TEMPLATE.format(
            generated_report=generated_text
        )
        claims_response = await llm.ainvoke(extract_prompt)
        claims = json.loads(claims_response.content)["claims"]

        if not claims:
            return None

        async def verify_claim(claim: str) -> int:
            verify_prompt = FAITHFULNESS_VERIFY_CLAIM_TEMPLATE.format(
                context=context,
                claim=claim,
            )
            verify_response = await llm.ainvoke(verify_prompt)
            return int(json.loads(verify_response.content)["supported"])

        scores = await asyncio.gather(*[verify_claim(c) for c in claims])

        faithfulness = sum(scores) / len(scores)

        if trace:
            trace.score(name="faithfulness", value=faithfulness)

        return faithfulness

    except Exception:
        return None


async def calculate_answer_relevancy(
    data: ReportResult,
    period_type: str,
    report_goal: str,
    llm: ChatOpenAI,
    trace: Optional[Any] = None,
) -> int | None:
    """Compute answer relevancy via LLM judge on a 1-5 scale.

    Returns:
        Relevancy score 1-5, or None if computation fails.
    """
    try:
        prompt = ANSWER_RELEVANCY_TEMPLATE.format(
            report_goal=report_goal,
            period_type=period_type,
            generated_report=data.generated_text,
        )

        response = await llm.ainvoke(prompt)
        score = json.loads(response.content)["score"]

        if trace:
            trace.score(name="answer_relevancy", value=score)

        return int(score)

    except Exception:
        return None
