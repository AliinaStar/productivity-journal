"""Node: create_report — final LLM generation step (all paths).

Selects the correct prompt template based on period and whether sub-period
summaries exist, calls the LLM with structured output, and writes the
typed Pydantic report + metadata back into the state.
"""

from src.rag.state import ReportState


async def create_report(state: ReportState) -> dict:
    """Generate the final structured report via LLM with structured output.

    Selects the correct system / user prompt template based on ``state['period']``.
    Uses ``MONTH_USER_BASELINE`` / ``YEAR_USER_BASELINE`` when
    ``sub_period_reports`` is None (no stored sub-period data in DB).

    Calls ``llm.with_structured_output(schema, include_raw=True)`` and raises
    ``ValueError`` on parse failure.

    Returns fields:
      week_report / month_report / year_report (typed Pydantic model),
      final_report (JSON string), tokens_used, generation_time.
    """
    raise NotImplementedError
