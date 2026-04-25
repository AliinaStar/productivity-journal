"""Main evaluation runner: runs all metrics for a single report."""

from typing import Any, Optional

from langchain_openai import ChatOpenAI

from notebooks.evaluation.metrics.context_precision import calculate_context_precision
from notebooks.evaluation.metrics.diversity import calculate_diversity, calculate_normalized_diversity
from notebooks.evaluation.metrics.ragas_metrics import (
    calculate_answer_relevancy,
    calculate_faithfulness,
)
from notebooks.evaluation.metrics.temporal_coverage import (
    calculate_temporal_breadth,
    calculate_temporal_coverage,
)
from notebooks.evaluation.schemas import (
    EvaluationLogger,
    EvaluationResult,
    ReportResult,
)
from src.core.settings import get_settings

settings = get_settings()
llm = ChatOpenAI(model=settings.eval_model, api_key=settings.openai_api_key, temperature=0, timeout=60, max_retries=2)

async def evaluate_report(
    report_result: ReportResult,
    report_goal: str,
    logger: EvaluationLogger,
    trace: Optional[Any] = None,
) -> EvaluationResult:
    import asyncio

    period_type = report_result.period

    diversity: float | None = None
    normalized_diversity: float | None = None
    temporal_coverage: float | None = None
    temporal_breadth: float | None = None
    context_precision: float | None = None

    if report_result.context:
        chunks = report_result.context.moment_chunks or []
        total_months = report_result.context.total_available_months
        pool_sim = report_result.context.pool_avg_similarity

        if len(chunks) >= 2:
            diversity = calculate_diversity(chunks)
            if pool_sim is not None:
                normalized_diversity = calculate_normalized_diversity(chunks, pool_sim)
            temporal_coverage = calculate_temporal_coverage(chunks)
            if total_months is not None and total_months > 0:
                temporal_breadth = calculate_temporal_breadth(chunks, total_months)
            context_precision = await calculate_context_precision(
                chunks, report_result.generated_text, llm, trace
            )

    faithfulness_report, answer_relevancy_report = await asyncio.gather(
        calculate_faithfulness(report_result, llm, trace),
        calculate_answer_relevancy(report_result, period_type, report_goal, llm, trace),
    )

    sample_id = (
        f"{report_result.user_id}"
        f"_{report_result.period}"
        f"_{report_result.period_start.isoformat()}"
    )

    result = EvaluationResult(
        sample_id=sample_id,
        method=report_result.method,
        user_id=report_result.user_id,
        period_start=report_result.period_start,
        period_type=period_type,
        diversity=diversity,
        normalized_diversity=normalized_diversity,
        temporal_coverage=temporal_coverage,
        temporal_breadth=temporal_breadth,
        context_precision=context_precision,
        faithfulness_report=faithfulness_report,
        answer_relevancy_report=answer_relevancy_report,
        report_tokens_used=report_result.tokens_used,
        report_generation_time=report_result.final_generation_time,
        generated_text=report_result.generated_text,
    )

    logger.log(result)
    return result
