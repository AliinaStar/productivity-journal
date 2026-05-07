"""Node: generate_summary — month / year path.

Reads sub-period Report rows from the DB and replaces current_entries
with LLM-compressed per-goal summaries.
"""

from src.rag import db
from src.rag.db import format_entries
from src.rag.llm import get_llm
from src.rag.state import ReportState
from src.rag.summarizer import generate_goal_summaries


async def generate_summary(state: ReportState) -> dict:
    """Replace current_entries with LLM-compressed per-goal summaries."""
    period = state["period"]
    date = state["date"]
    user_id = state["user_id"]
    language = state["language"]

    sub_period = "week" if period == "month" else "month"
    reports = await db.query_sub_period_reports(period, date, user_id)
    goal_summaries, summary_tokens = await generate_goal_summaries(
        reports, sub_period, language, get_llm()
    )

    if goal_summaries:
        return {
            "current_entries": goal_summaries,
            "sub_period_reports": format_entries(goal_summaries),
            "summary_tokens_used": summary_tokens,
        }
    return {
        "sub_period_reports": None,
        "summary_tokens_used": 0,
    }
