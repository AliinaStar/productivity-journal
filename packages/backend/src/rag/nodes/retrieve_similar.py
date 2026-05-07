"""Node: retrieve_similar — month / year path.

Queries historical entries via MMR retrieval to build the RAG context
(prev_entries) that is injected into the final report prompt.
"""

from collections import defaultdict
from datetime import date as date_type

from src.rag.db import format_entries
from src.rag.retrieval import retrieve_similar_mmr
from src.rag.state import ReportState


async def retrieve_similar(state: ReportState) -> dict:
    """Build prev_entries from historical entries via MMR retrieval."""
    period = state["period"]
    date = state["date"]
    user_id = state["user_id"]
    current_entries = state["current_entries"]
    has_summaries = bool(state.get("sub_period_reports"))

    ref_date: date_type = (
        date_type(date["year"], date["month"], 1)
        if period == "month"
        else date_type(date["year"], 1, 1)
    )

    prev_entries: list[dict] = []

    if has_summaries:
        for goal in current_entries:
            query = goal["notes"][0]
            past = await retrieve_similar_mmr(
                user_id, query, before_date=ref_date, top_k=5
            )
            if past:
                prev_entries.append({
                    "goal_id": goal["goal_id"],
                    "name": goal["name"],
                    "notes": [e.note for e in past],
                })
    else:
        query_text = format_entries(current_entries)
        all_past = await retrieve_similar_mmr(
            user_id, query_text, before_date=ref_date, top_k=10
        )
        past_by_goal: dict[int, list[str]] = defaultdict(list)
        for e in all_past:
            past_by_goal[e.goal_id].append(e.note)
        prev_entries = [
            {"goal_id": gid, "name": str(gid), "notes": notes}
            for gid, notes in past_by_goal.items()
        ]

    return {"prev_entries": prev_entries}
