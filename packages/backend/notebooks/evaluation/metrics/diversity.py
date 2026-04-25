"""Diversity metric: average pairwise cosine similarity between retrieved chunks."""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from notebooks.evaluation.schemas import RetrievedChunk


def _avg_pairwise_similarity(embeddings: np.ndarray) -> float:
    sim = cosine_similarity(embeddings)
    n = len(embeddings)
    mask = np.triu(np.ones((n, n), dtype=bool), k=1)
    return float(sim[mask].mean())


def calculate_diversity(chunks: list[RetrievedChunk]) -> float:
    """1 - avg_pairwise_cosine_similarity of retrieved chunks. Range [0, 1]."""
    if len(chunks) < 2:
        raise ValueError("diversity requires at least 2 chunks")
    embeddings = np.array([c.embedding for c in chunks])
    return 1.0 - _avg_pairwise_similarity(embeddings)


def calculate_normalized_diversity(chunks: list[RetrievedChunk], pool_avg_similarity: float) -> float | None:
    """Retrieved diversity divided by pool diversity.

    > 1.0 → retrieved chunks are more diverse than the pool average (MMR working).
    = 1.0 → same diversity as random selection.
    < 1.0 → retrieved chunks are less diverse than the pool.
    """
    if len(chunks) < 2:
        return None
    pool_diversity = 1.0 - pool_avg_similarity
    if pool_diversity <= 0:
        return None
    return calculate_diversity(chunks) / pool_diversity
