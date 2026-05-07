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

import asyncio

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from src.db.models import Report
from src.rag.prompts.summary import SUMMARY_LENGTH, SUMMARY_TEMPLATE


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
        chronologically ordered list of ``"[YYYY-MM-DD] <summary>"`` strings.
        Goals without any non-empty summary are omitted.
    """
    goals_by_id: dict[int, dict] = {}
    for report in reports:
        if not report.final_report:
            continue
        data = report.final_report
        period_label = str(report.period_start)
        for goal in data.get("goals", []):
            gid = goal.get("goal_id")
            if gid is None:
                continue
            if gid not in goals_by_id:
                goals_by_id[gid] = {
                    "goal_id": gid,
                    "name": goal.get("name", str(gid)),
                    "notes": [],
                }
            summary = goal.get("summary", "")
            if summary:
                goals_by_id[gid]["notes"].append(f"[{period_label}] {summary}")
    return list(goals_by_id.values())


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
        language:   Language code / name forwarded to the prompt template.
        llm:        Shared ``ChatOpenAI`` instance from the pipeline.

    Returns:
        A tuple of:
          - list of ``{goal_id, name, notes: [compressed_summary]}`` dicts
          - total tokens consumed across all LLM calls
        Returns ``([], 0)`` when *reports* is empty or contains no goal data.
    """
    goal_data = extract_goal_summaries(reports)
    if not goal_data:
        return [], 0

    period_type = "weekly" if sub_period == "week" else "monthly"
    target_length = SUMMARY_LENGTH["month"] if sub_period == "week" else SUMMARY_LENGTH["year"]

    prompts = [
        SUMMARY_TEMPLATE.format(
            period_type=period_type,
            target_length=target_length,
            reports="\n".join(goal["notes"]),
            additional_entries_block="",
            language=language,
        )
        for goal in goal_data
    ]

    responses = await asyncio.gather(
        *[llm.ainvoke([HumanMessage(content=p)]) for p in prompts]
    )

    total_tokens = 0
    result = []
    for goal, response in zip(goal_data, responses):
        if response.usage_metadata:
            total_tokens += response.usage_metadata.get("total_tokens", 0)
        result.append({
            "goal_id": goal["goal_id"],
            "name": goal["name"],
            "notes": [response.content],
        })
    return result, total_tokens
