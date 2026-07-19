"""Regression tests for ``src.rag.db.query_entries``.

These guard the period boundary of the data that reaches the LLM prompt.

Background: ``query_entries`` used ``joinedload(Goal.entries)`` alongside a
``.join(Goal.entries).where(<period filter>)``. joinedload emits its own,
separately-aliased join that the WHERE clause does not touch, so every
``goal.entries`` collection came back with the goal's entries *across all
time*. The aggregate metrics (avg_productivity / active_days) were computed by
a separate, correctly-filtered query and therefore looked right, which is what
hid the bug — but ``entries`` and ``goal_metrics_block``, both built from
``goal.entries``, leaked the full history into the report prompt.

The fix is ``contains_eager``, which makes the filtered join populate the
collection. If anyone reverts to joinedload, these tests fail.
"""

import asyncio

from src.db import session as session_module
from src.rag import db as rag_db

# ISO week 2 of 2026 = Mon 2026-01-05 .. Sun 2026-01-11
# ISO week 3 of 2026 = Mon 2026-01-12 .. Sun 2026-01-18
WEEK_2 = {"year": 2026, "week": 2}
WEEK_3 = {"year": 2026, "week": 3}


def _run(make_coro):
    """Run an async DB call on a fresh engine bound to this test's event loop.

    The engine/sessionmaker in ``src.db.session`` are module-level singletons.
    Reusing one across ``asyncio.run`` calls would bind its pool to a closed
    loop, so it is rebuilt and disposed around every test.
    """
    async def _main():
        try:
            return await make_coro()
        finally:
            if session_module._engine is not None:
                await session_module._engine.dispose()

    session_module._engine = None
    session_module._async_sessionmaker = None
    try:
        return asyncio.run(_main())
    finally:
        session_module._engine = None
        session_module._async_sessionmaker = None


def _make_goal(db, user_id: int, title: str) -> int:
    row = db.execute(
        """INSERT INTO goal (user_id, title, description, deadline, created_at, status)
           VALUES (%s, %s, NULL, NULL, DATE '2026-01-01', 'active') RETURNING id""",
        (user_id, title),
    ).fetchone()
    return row[0]


def _add_entry(db, goal_id: int, date_note: str, note: str, score: int) -> None:
    db.execute(
        """INSERT INTO entry (goal_id, date_note, note, productivity_score, embedding)
           VALUES (%s, %s, %s, %s, NULL)""",
        (goal_id, date_note, note, score),
    )


def test_week_entries_exclude_other_weeks(client, db, make_user):
    """The notes handed to the LLM must contain only the requested week."""
    user = make_user()
    goal_id = _make_goal(db, user["user_id"], "Running")

    # Target week (ISO week 2).
    _add_entry(db, goal_id, "2026-01-05", "week2-monday", 4)
    _add_entry(db, goal_id, "2026-01-07", "week2-wednesday", 2)
    # Neighbouring week — must not leak in.
    _add_entry(db, goal_id, "2026-01-12", "week3-monday", 5)
    _add_entry(db, goal_id, "2026-01-13", "week3-tuesday", 5)
    _add_entry(db, goal_id, "2026-01-14", "week3-wednesday", 5)

    result = _run(lambda: rag_db.query_entries("week", WEEK_2, user["user_id"]))

    notes = [note for goal in result["entries"] for note in goal["notes"]]
    assert sorted(notes) == ["week2-monday", "week2-wednesday"]
    assert not any("week3" in n for n in notes), (
        "entries from an adjacent week leaked into the prompt — "
        "joinedload was probably reintroduced in query_entries"
    )
    assert len(result["raw_entries"]) == 2


def test_goal_metrics_block_counts_only_the_week(client, db, make_user):
    """Per-goal metrics in the prompt must be scoped to the period too.

    With the joinedload bug this reported 5 active days and avg 4.2 (all time)
    instead of 2 days and avg 3.0 (the week).
    """
    user = make_user()
    goal_id = _make_goal(db, user["user_id"], "Running")

    _add_entry(db, goal_id, "2026-01-05", "week2-monday", 4)
    _add_entry(db, goal_id, "2026-01-07", "week2-wednesday", 2)
    _add_entry(db, goal_id, "2026-01-12", "week3-monday", 5)
    _add_entry(db, goal_id, "2026-01-13", "week3-tuesday", 5)
    _add_entry(db, goal_id, "2026-01-14", "week3-wednesday", 5)

    result = _run(lambda: rag_db.query_entries("week", WEEK_2, user["user_id"]))

    assert "2 active days" in result["goal_metrics_block"]
    assert "avg score 3.0" in result["goal_metrics_block"]
    # Aggregates were always correct; assert them so a fix cannot regress them.
    assert result["active_days"] == 2
    assert result["avg_productivity"] == 3.0


def test_goals_without_entries_in_the_week_are_absent(client, db, make_user):
    """A goal touched only in another week must not appear at all."""
    user = make_user()
    active = _make_goal(db, user["user_id"], "Running")
    other = _make_goal(db, user["user_id"], "Reading")

    _add_entry(db, active, "2026-01-05", "week2-monday", 4)
    _add_entry(db, other, "2026-01-12", "week3-monday", 5)

    result = _run(lambda: rag_db.query_entries("week", WEEK_2, user["user_id"]))

    assert [g["name"] for g in result["entries"]] == ["Running"]
    assert "Reading" not in result["goal_metrics_block"]


def test_month_period_excludes_other_months(client, db, make_user):
    """The same scoping must hold for the month path, which feeds RAG context."""
    user = make_user()
    goal_id = _make_goal(db, user["user_id"], "Running")

    _add_entry(db, goal_id, "2026-01-05", "january-a", 4)
    _add_entry(db, goal_id, "2026-01-20", "january-b", 2)
    _add_entry(db, goal_id, "2026-02-03", "february-a", 5)

    result = _run(
        lambda: rag_db.query_entries(
            "month", {"year": 2026, "month": 1}, user["user_id"]
        )
    )

    notes = [note for goal in result["entries"] for note in goal["notes"]]
    assert sorted(notes) == ["january-a", "january-b"]
    assert result["active_days"] == 2


def test_entries_scoped_to_the_requesting_user(client, db, make_user):
    """Another user's entries must never reach the prompt."""
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")

    alice_goal = _make_goal(db, alice["user_id"], "Running")
    bob_goal = _make_goal(db, bob["user_id"], "Running")
    _add_entry(db, alice_goal, "2026-01-05", "alice-note", 4)
    _add_entry(db, bob_goal, "2026-01-05", "bob-note", 5)

    result = _run(lambda: rag_db.query_entries("week", WEEK_2, alice["user_id"]))

    notes = [note for goal in result["entries"] for note in goal["notes"]]
    assert notes == ["alice-note"]
