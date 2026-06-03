"""Unit tests for pure RAG/scheduler helpers (no LLM, no DB)."""

from datetime import date

from src.rag.db import format_entries
from src.rag.scheduler import _period_dates


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


def test_period_dates_week():
    # ISO week 2 of 2026 starts Mon 2026-01-05.
    start, end = _period_dates("week", {"year": 2026, "week": 2})
    assert start == date(2026, 1, 5)
    assert end == date(2026, 1, 11)


def test_period_dates_month():
    start, end = _period_dates("month", {"year": 2026, "month": 2})
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)


def test_period_dates_year():
    start, end = _period_dates("year", {"year": 2026})
    assert start == date(2026, 1, 1)
    assert end == date(2026, 12, 31)
