"""Node: retrieve_entries — week path entry point.

Loads current-week entries from the DB along with user metadata
and aggregate productivity metrics.
"""

from src.rag.state import ReportState


async def retrieve_entries(state: ReportState) -> dict:
    """Load current-week entries, user language/gender, and aggregate metrics.

    Calls ``db.query_entries`` and ``db.get_user``.

    Returns fields:
      current_entries, prev_entries=[], sub_period_reports=None,
      summary_tokens_used=0, avg_productivity, active_days,
      goal_metrics_block, language, gender.
    """
    raise NotImplementedError
