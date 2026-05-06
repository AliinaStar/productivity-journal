"""MMR-based semantic retrieval of historical entries.

Maximal Marginal Relevance (MMR) balances relevance to the query with
diversity among selected results, avoiding redundant chunks in the context
passed to the LLM.

Algorithm (λ = 0.5):
    mmr_score = λ * relevance(candidate, query)
              - (1 - λ) * max_similarity(candidate, already_selected)

Steps:
    1. Encode the query with the embedding model.
    2. Load all user entries with embeddings that predate *before_date*.
    3. Rank by relevance; keep the top *fetch_k* as candidates.
    4. Greedily pick *top_k* entries via the MMR formula.
"""

from datetime import date as date_type

from src.db.models import Entry


async def retrieve_similar_mmr(
    user_id: int,
    query_text: str,
    before_date: date_type,
    top_k: int = 15,
    fetch_k: int = 20,
) -> list[Entry]:
    """Return up to *top_k* diverse, relevant historical entries via MMR.

    Args:
        user_id:     Filter entries to this user (via Goal.user_id).
        query_text:  Plain-text query; will be encoded by the embedding model.
        before_date: Only entries strictly before this date are considered.
        top_k:       Final number of entries to return.
        fetch_k:     Candidate pool size before MMR re-ranking.
                     Must be >= *top_k*; clamped to the number of available entries.

    Returns:
        ORM ``Entry`` objects ordered by MMR selection (most relevant/diverse first).
        Returns an empty list when no embedded entries exist before *before_date*.
    """
    raise NotImplementedError
