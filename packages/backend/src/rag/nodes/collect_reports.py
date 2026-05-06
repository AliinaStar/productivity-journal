"""Node: collect_reports — month / year path entry point.

Loads current-period entries and user info from the DB.
Structurally identical to ``retrieve_entries`` but feeds into
``generate_summary`` and ``retrieve_similar`` rather than directly
into ``create_report``.
"""

from src.rag.state import ReportState


async def collect_reports(state: ReportState) -> dict:
    """Load current-period entries and user info for month / year reports.

    Calls ``db.query_entries`` and ``db.get_user``.

    Returns fields:
      current_entries, prev_entries=[], sub_period_reports=None,
      summary_tokens_used=0, avg_productivity, active_days,
      goal_metrics_block, language, gender.
    """
    raise NotImplementedError
