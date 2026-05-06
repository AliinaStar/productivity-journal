"""Node: generate_summary — month / year path.

Reads sub-period Report rows from the DB and replaces current_entries
with LLM-compressed per-goal summaries. These summaries are later used
both as the main context for create_report and as queries for retrieve_similar.
"""

from src.rag.state import ReportState


async def generate_summary(state: ReportState) -> dict:
    """Replace current_entries with LLM-compressed per-goal summaries.

    Reads sub-period ``Report`` rows from the DB via ``db.query_sub_period_reports``,
    then calls ``summarizer.generate_goal_summaries`` (one parallel LLM call
    per goal).

    If no stored reports exist (user's first month / year), returns
    ``sub_period_reports=None`` and leaves current_entries unchanged.

    Returns fields:
      current_entries (updated), sub_period_reports, summary_tokens_used.
    """
    raise NotImplementedError
