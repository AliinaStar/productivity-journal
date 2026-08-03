"""Database query helpers for the report-generation pipeline.

All functions are async and use the shared ``get_async_sessionmaker`` singleton.
No business logic lives here — only data access.
"""

from collections import defaultdict
from datetime import date as date_type, date

import numpy as np
from sqlalchemy import extract, func, select, tuple_
from sqlalchemy.orm import contains_eager

from src.db.models import Entry, Goal, Report, User
from src.db.session import get_async_sessionmaker
from src.rag.state import DateDict


def format_entries(entries: list[dict]) -> str:
    """Format a list of ``{goal_id, name, notes}`` dicts into a prompt-ready string.

    Example output::

        **Goal A**
        - note 1
        - note 2

        **Goal B**
        - note 3
    """
    parts = []
    for goal in entries:
        notes_text = "\n".join(f"- {note}" for note in goal["notes"])
        parts.append(f"**{goal['name']}**\n{notes_text}")
    return "\n\n".join(parts) if parts else "No entries."


def build_where_clause(period: str, date: DateDict, user_id: int):
    """Return a SQLAlchemy WHERE expression that filters entries by period and user.

    Supports ``'week'``, ``'month'``, and ``'year'`` periods.
    Uses ``extract()`` on ``Entry.date_note``.
    """
    user_filter = Goal.user_id == user_id
    if period == "year":
        return user_filter & (extract("year", Entry.date_note) == date["year"])
    elif period == "month":
        return (
            user_filter
            & (extract("month", Entry.date_note) == date["month"])
            & (extract("year", Entry.date_note) == date["year"])
        )
    else:
        # 'isoyear', not 'year': ISO week 1 can start in late December
        # (e.g. 2025-12-29 belongs to ISO week 1 of 2026), so the year must
        # follow the same ISO week-numbering as extract('week') does.
        return (
            user_filter
            & (extract("week", Entry.date_note) == date["week"])
            & (extract("isoyear", Entry.date_note) == date["year"])
        )


async def report_exists(user_id: int, period: str, period_start: date_type) -> bool:
    """True if a report already exists for (user, period, period_start).

    Lets the scheduler skip regeneration: cron retries and the startup
    catch-up job are idempotent thanks to this check (plus the DB-level
    unique constraint as a safety net).
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Report.id)
            .where(Report.user_id == user_id)
            .where(Report.period == period)
            .where(Report.period_start == period_start)
            .limit(1)
        )
        return result.first() is not None


async def existing_report_keys(
    periods: set[tuple[str, date_type]],
) -> set[tuple[int, str, date_type]]:
    """Which ``(user_id, period, period_start)`` reports already exist.

    The batched form of :func:`report_exists`. The hourly scheduler asks this
    once per tick instead of once per user per period — with the periods being
    the same handful of ``(period, period_start)`` pairs for everybody, that is
    one query rather than three per user every hour.
    """
    if not periods:
        return set()
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Report.user_id, Report.period, Report.period_start).where(
                tuple_(Report.period, Report.period_start).in_(list(periods))
            )
        )
        return {(row.user_id, row.period, row.period_start) for row in result}


async def count_entries(period: str, date: DateDict, user_id: int) -> int:
    """Count the user's entries inside a period without loading them.

    Used by the scheduler to skip report generation (and the LLM call)
    entirely for users who wrote nothing during the period.
    """
    session_factory = get_async_sessionmaker()
    where_clause = build_where_clause(period, date, user_id)
    async with session_factory() as session:
        result = await session.execute(
            select(func.count(Entry.id))
            .join(Goal, Entry.goal_id == Goal.id)
            .where(where_clause)
        )
        return int(result.scalar_one())


async def query_entries(period: str, date: DateDict, user_id: int) -> dict:
    """Load current-period entries together with aggregate metrics.

    Returns a dict with keys:
      - ``entries``            – list of ``{goal_id, name, notes}``
      - ``raw_entries``        – list of ORM ``Entry`` objects (for embeddings)
      - ``avg_productivity``   – float, rounded to 2 decimals
      - ``active_days``        – int
      - ``goal_metrics_block`` – pre-formatted string for the LLM prompt
    """
    session_factory = get_async_sessionmaker()
    where_clause = build_where_clause(period, date, user_id)

    async with session_factory() as session:
        # contains_eager (not joinedload): the WHERE-filtered join below must
        # populate goal.entries, so each goal carries ONLY the current period's
        # entries. joinedload adds its own unfiltered join, which would load
        # every entry of the goal across all time and leak them into the prompt.
        result = await session.execute(
            select(Goal)
            .join(Goal.entries)
            .options(contains_eager(Goal.entries))
            .where(where_clause)
        )
        goals = result.unique().scalars().all()

        metrics = await session.execute(
            select(
                func.round(func.avg(Entry.productivity_score), 2),
                func.count(func.distinct(Entry.date_note)),
            )
            .join(Goal, Entry.goal_id == Goal.id)
            .where(where_clause)
        )
        avg_productivity, active_days = metrics.one()

        raw_entries_result = await session.execute(
            select(Entry)
            .join(Goal, Entry.goal_id == Goal.id)
            .where(where_clause)
            .order_by(Entry.date_note)
        )
        raw_entries = raw_entries_result.scalars().all()

    entries = [
        {"goal_id": goal.id, "name": goal.title, "notes": [e.note for e in goal.entries]}
        for goal in goals
    ]

    goal_metrics_lines = []
    for goal in goals:
        if goal.entries:
            active_days_goal = len({e.date_note for e in goal.entries})
            avg_score = sum(e.productivity_score for e in goal.entries) / len(goal.entries)
            goal_metrics_lines.append(
                f"- {goal.id}: {goal.title}: {active_days_goal} active days,"
                f" avg score {avg_score:.1f}"
            )

    return {
        "entries": entries,
        "avg_productivity": float(avg_productivity or 0),
        "active_days": int(active_days or 0),
        "goal_metrics_block": "\n".join(goal_metrics_lines),
        "raw_entries": list(raw_entries),
    }


async def query_sub_period_reports(
    period: str,
    date: DateDict,
    user_id: int,
) -> list[Report]:
    """Load sub-period ``Report`` rows from the DB for use in ``generate_summary``.

    - For ``period='month'``: fetches weekly reports that fall inside that month.
    - For ``period='year'``:  fetches monthly reports that fall inside that year.

    Returns rows ordered by ``period_start`` ascending.
    """
    session_factory = get_async_sessionmaker()
    sub_period = "week" if period == "month" else "month"

    async with session_factory() as session:
        stmt = (
            select(Report)
            .where(Report.user_id == user_id)
            .where(Report.period == sub_period)
        )
        if period == "month":
            stmt = stmt.where(
                extract("month", Report.period_start) == date["month"],
                extract("year", Report.period_start) == date["year"],
            )
        else:
            stmt = stmt.where(
                extract("year", Report.period_start) == date["year"],
            )
        result = await session.execute(stmt.order_by(Report.period_start))
        return list(result.scalars().all())


async def get_user(user_id: int) -> User | None:
    """Fetch a single ``User`` row by primary key."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        return await session.get(User, user_id)


async def get_all_users() -> list[User]:
    """Fetch all ``User`` rows from the DB.

    Used by the scheduler to iterate over users when running a batch
    report generation job.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(select(User))
        return list(result.scalars().all())


async def count_available_months(user_id: int, before_date: date_type) -> int:
    """Count distinct calendar months in the user's history before *before_date*.

    Used by ``retrieve_similar`` to populate ``total_available_months`` in context.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Entry.date_note)
            .join(Goal, Entry.goal_id == Goal.id)
            .where(Goal.user_id == user_id)
            .where(Entry.date_note < before_date)
        )
        dates = result.scalars().all()
    return len({d.strftime("%Y-%m") for d in dates})


async def compute_pool_avg_similarity(
    user_id: int,
    before_date: date_type,
) -> float | None:
    """Compute average pairwise cosine similarity of all historical embeddings.

    Returns ``None`` when fewer than two embedded entries exist.
    Used as a diversity baseline for evaluation metrics.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Entry)
            .join(Goal, Entry.goal_id == Goal.id)
            .where(Goal.user_id == user_id)
            .where(Entry.date_note < before_date)
            .where(Entry.embedding.isnot(None))
        )
        entries = result.scalars().all()

    if len(entries) < 2:
        return None

    mat = np.array([list(e.embedding) for e in entries], dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    mat = mat / norms
    sim = mat @ mat.T
    n = len(mat)
    mask = np.triu(np.ones((n, n), dtype=bool), k=1)
    return float(sim[mask].mean())


async def save_report(
    user_id: int,
    period: str,
    period_start: date_type,
    period_end: date_type,
    avg_productivity: float | None,
    active_days: int,
    final_report: dict,
    tokens_used: int | None = None,
    generation_time: float | None = None,
) -> Report:
    """Persist a generated report to the ``report`` table and return the new row.

    Args:
        user_id:          Owner of the report.
        period:           ``'week'``, ``'month'``, or ``'year'``.
        period_start:     First day of the covered period.
        period_end:       Last day of the covered period.
        avg_productivity: Average productivity score across all entries
                          in the period (may be ``None`` if no entries).
        active_days:      Number of distinct days with at least one entry.
        final_report:     Parsed report dict (``model.model_dump()``),
                          stored as JSONB.
        tokens_used:      Total LLM tokens spent generating this report,
                          summaries included. ``None`` if not measured.
        generation_time:  Wall-clock seconds spent in the final LLM call.

    Returns:
        The newly created ``Report`` ORM object with its ``id`` populated.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        row = Report(
            user_id=user_id,
            period=period,
            period_start=period_start,
            period_end=period_end,
            avg_productivity=avg_productivity,
            active_days=active_days,
            created_at=date.today(),
            final_report=final_report,
            tokens_used=tokens_used,
            generation_time=generation_time,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row
