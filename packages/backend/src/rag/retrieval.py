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

import numpy as np
from sqlalchemy import select

from src.db.models import Entry, Goal
from src.db.session import get_async_sessionmaker
from src.rag.embeddings import embed_text


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
                     Clamped to the number of available entries.

    Returns:
        ORM ``Entry`` objects ordered by MMR selection (most relevant/diverse first).
        Returns an empty list when no embedded entries exist before *before_date*.
    """
    query_emb = await embed_text(query_text)

    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Entry)
            .join(Goal, Entry.goal_id == Goal.id)
            .where(Goal.user_id == user_id)
            .where(Entry.embedding.isnot(None))
            .where(Entry.date_note < before_date)
        )
        entries = result.scalars().all()

    if not entries:
        return []

    embeddings_matrix = np.array([list(e.embedding) for e in entries])
    relevance = embeddings_matrix @ query_emb

    fetch_k = min(fetch_k, len(entries))
    candidate_idx = np.argsort(relevance)[::-1][:fetch_k].tolist()
    candidate_relevance = relevance[candidate_idx]
    candidate_embs = embeddings_matrix[candidate_idx]

    selected_local: list[int] = []
    for _ in range(min(top_k, fetch_k)):
        if not selected_local:
            best_local = int(np.argmax(candidate_relevance))
        else:
            selected_embs = candidate_embs[selected_local]
            redundancy = (candidate_embs @ selected_embs.T).max(axis=1)
            mmr_score = 0.5 * candidate_relevance - 0.5 * redundancy
            mmr_score[selected_local] = -np.inf
            best_local = int(np.argmax(mmr_score))
        selected_local.append(best_local)

    return [entries[candidate_idx[i]] for i in selected_local]
