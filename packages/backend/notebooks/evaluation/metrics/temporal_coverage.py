"""Temporal coverage metrics: how retrieved chunks span available history."""

from notebooks.evaluation.schemas import RetrievedChunk


def calculate_temporal_coverage(chunks: list[RetrievedChunk]) -> float:
    """Efficiency of temporal spread: unique months per chunk retrieved.

    Formula: (unique_months - 1) / (n_chunks - 1)
    Range: [0, 1]. 1.0 = every chunk from a distinct month.

    Answers: "how efficiently does each retrieved chunk add a new time period?"
    Low for raw_generation (many chunks, few unique months).
    High for mmr_rag (few chunks, explicitly diverse).
    """
    if len(chunks) < 2:
        raise ValueError("temporal_coverage requires at least 2 chunks")

    unique_months = len({c.date.strftime("%Y-%m") for c in chunks})
    return (unique_months - 1) / (len(chunks) - 1)


def calculate_temporal_breadth(
    chunks: list[RetrievedChunk],
    total_available_months: int,
) -> float:
    """Breadth of temporal coverage: fraction of available history reached.

    Formula: unique_months_retrieved / total_available_months
    Range: [0, 1]. 1.0 = retrieved chunks span every available month.

    Answers: "how much of the available historical timeline did retrieval cover?"
    For raw_generation: always high (passes everything).
    For RAG: depends on how spread the top-k selection is.
    """
    if total_available_months == 0:
        return 0.0

    unique_months = len({c.date.strftime("%Y-%m") for c in chunks})
    return unique_months / total_available_months
