"""Embedding model singleton for the RAG pipeline.

The model is loaded once on first access and reused for the lifetime of the
process. Using ``lru_cache`` keeps the interface simple without requiring a
global variable or dependency-injection container.

Model: ``Alibaba-NLP/gte-multilingual-base`` (768-dimensional embeddings,
same model used when entries were stored in the database).
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load and cache the sentence-transformer model.

    Subsequent calls return the cached instance without re-loading weights.
    ``trust_remote_code=True`` is required by the GTE model.
    """
    return SentenceTransformer(
        "Alibaba-NLP/gte-multilingual-base",
        trust_remote_code=True,
    )
