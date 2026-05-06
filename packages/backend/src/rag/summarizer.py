"""Per-goal LLM summarisation of sub-period reports.

Reads stored ``Report`` rows from the database (not from an in-memory store),
groups goal summaries across sub-periods, and generates a compressed
LLM summary per goal that is then used as the ``current_entries`` context
for the month / year report generation node.

Flow:
    DB Report rows
        → extract_goal_summaries()   # group per goal_id
        → generate_goal_summaries()  # one LLM call per goal (parallelised)
        → list[{goal_id, name, notes: [summary]}]
"""

from langchain_openai import ChatOpenAI

from src.db.models import Report


def extract_goal_summaries(reports: list[Report]) -> list[dict]:
    """Extract and group per-goal summaries from a list of DB ``Report`` objects.

    Each ``Report.final_report`` is a JSONB dict (already deserialised by
    SQLAlchemy) with a ``goals`` list, where every item contains
    ``goal_id``, ``name``, and ``summary``.

    Args:
        reports: Ordered list of ``Report`` ORM objects for a single sub-period
                 (e.g. weekly reports inside a target month).

    Returns:
        A list of ``{goal_id, name, notes}`` dicts, where ``notes`` is a
        chronologically ordered list of ``"[YYYY-MM-DD] <summary>"`` strings
        ready to be fed into the summarisation prompt.
        Goals without any non-empty summary are omitted.
    """
    raise NotImplementedError


async def generate_goal_summaries(
    reports: list[Report],
    sub_period: str,
    language: str,
    llm: ChatOpenAI,
) -> tuple[list[dict], int]:
    """Generate one LLM summary per goal from sub-period reports.

    Calls ``extract_goal_summaries`` internally, then fires one
    ``llm.ainvoke`` per goal in parallel via ``asyncio.gather``.

    Args:
        reports:    DB ``Report`` rows for the relevant sub-period.
        sub_period: ``'week'`` (when building a month report) or
                    ``'month'`` (when building a year report).
                    Determines prompt wording and target summary length.
        language:   Language code / name forwarded to the prompt template.
        llm:        Shared ``ChatOpenAI`` instance from the pipeline.

    Returns:
        A tuple of:
          - list of ``{goal_id, name, notes: [compressed_summary]}`` dicts
            (same shape as ``current_entries`` in ``ReportState``)
          - total tokens consumed across all LLM calls
        Returns ``([], 0)`` when *reports* is empty or contains no goal data.
    """
    raise NotImplementedError
