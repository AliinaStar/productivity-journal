"""Node: retrieve_similar — month / year path.

Queries historical entries via MMR retrieval to build the RAG context
(prev_entries) that is injected into the final report prompt.
"""

from src.rag.state import ReportState


async def retrieve_similar(state: ReportState) -> dict:
    """Build prev_entries from historical entries via MMR retrieval.

    For each goal in current_entries, calls ``retrieval.retrieve_similar_mmr``
    using the goal's compressed summary as the query (top_k=5 per goal).

    Falls back to a single concatenated query over all current_entries when
    sub_period_reports is None (no stored sub-period reports in DB),
    using top_k=10.

    Returns fields: prev_entries.
    """
    raise NotImplementedError
