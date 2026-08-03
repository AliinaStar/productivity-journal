"""Unit tests for pure RAG/scheduler helpers (no LLM, no DB).

Period-boundary maths moved to ``src.core.periods``; see ``test_periods.py``.
"""

from src.rag.db import format_entries


def test_format_entries_groups_notes_by_goal():
    out = format_entries([
        {"goal_id": 1, "name": "Run", "notes": ["2 km", "3 km"]},
        {"goal_id": 2, "name": "Read", "notes": ["20 pages"]},
    ])
    assert "**Run**" in out
    assert "- 2 km" in out
    assert "- 3 km" in out
    assert "**Read**" in out


def test_format_entries_empty():
    assert format_entries([]) == "No entries."
