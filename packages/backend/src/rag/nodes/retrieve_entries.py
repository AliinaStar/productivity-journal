"""Node: retrieve_entries — week path entry point.

Loads current-week entries from the DB along with user metadata
and aggregate productivity metrics.
"""

from src.rag import db
from src.rag.state import ReportState


async def retrieve_entries(state: ReportState) -> dict:
    """Load current-week entries, user language/gender, and aggregate metrics."""
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
