"""Node: collect_reports — month / year path entry point.

Loads current-period entries and user info from the DB.
Structurally identical to ``retrieve_entries`` but feeds into
``generate_summary`` and ``retrieve_similar`` rather than directly
into ``create_report``.
"""

from src.rag import db
from src.rag.state import ReportState


async def collect_reports(state: ReportState) -> dict:
    """Load current-period entries and user info for month / year reports."""
    period = state["period"]
    date = state["date"]
    user_id = state["user_id"]

    current = await db.query_entries(period, date, user_id)
    user = await db.get_user(user_id)

    return {
        "current_entries": current["entries"],
        "prev_entries": [],
        "sub_period_reports": None,
        "summary_tokens_used": 0,
        "avg_productivity": current["avg_productivity"],
        "active_days": current["active_days"],
        "goal_metrics_block": current["goal_metrics_block"],
        "language": user.language,
        "gender": user.gender,
    }
