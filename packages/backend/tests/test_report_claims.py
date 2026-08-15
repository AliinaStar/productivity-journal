"""The report state machine, against a real database.

These cover what the status column was added for: telling apart a period
nobody has looked at, one with nothing to say, and one whose generation
failed. Before it all three were "no row", so a week that failed to generate
was indistinguishable from a quiet one and disappeared without trace.

Everything goes through the async ``src.rag.db`` helpers rather than raw SQL,
so the claim under test really is the conditional UPDATE the scheduler relies
on to keep two overlapping ticks off the same period.
"""

import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from src.db.models import Report, User
from src.db.session import get_async_sessionmaker
from src.rag import db

WEEK_START = date(2026, 8, 3)
WEEK_END = date(2026, 8, 9)
MAX_ATTEMPTS = 5


@pytest.fixture()
def arun():
    """Run coroutines in one loop per test, then drop the pooled engine.

    The engine is a module-level singleton with a connection pool. A
    connection opened in one test's loop and handed to the next test's loop is
    bound to a loop that no longer runs, so the pool is disposed here rather
    than left to leak across tests.
    """
    loop = asyncio.new_event_loop()
    yield loop.run_until_complete

    from src.db import session as session_module

    if session_module._engine is not None:
        loop.run_until_complete(session_module._engine.dispose())
        session_module._engine = None
        session_module._async_sessionmaker = None
    loop.close()


async def _make_user(email: str) -> int:
    """Insert a user directly — no TestClient, so everything stays in one loop."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user = User(name="Claims", email=email, language="English")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def _claim(user_id: int, **over) -> bool:
    kwargs = dict(
        user_id=user_id,
        period="week",
        period_start=WEEK_START,
        period_end=WEEK_END,
        stale_before=datetime.now(timezone.utc) - timedelta(hours=2),
        max_attempts=MAX_ATTEMPTS,
    )
    kwargs.update(over)
    return await db.claim_report(**kwargs)


async def _state(user_id: int):
    states = await db.report_states({("week", WEEK_START)})
    return states.get((user_id, "week", WEEK_START))


async def _rows(user_id: int) -> list[Report]:
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(select(Report).where(Report.user_id == user_id))
        return list(result.scalars().all())


# --- claiming ---------------------------------------------------------------

def test_first_claim_creates_the_row_and_takes_it(arun):
    user_id = arun(_make_user("first-claim@example.com"))
    assert arun(_claim(user_id)) is True

    status, attempts, started_at = arun(_state(user_id))
    assert status == "running"
    assert attempts == 1
    assert started_at is not None


def test_a_second_tick_cannot_take_a_live_claim(arun):
    """Two overlapping ticks must not both generate the same report — newly
    possible now that one tick may work several periods and overrun the hour."""
    user_id = arun(_make_user("second-tick@example.com"))
    assert arun(_claim(user_id)) is True
    assert arun(_claim(user_id)) is False

    _, attempts, _ = arun(_state(user_id))
    assert attempts == 1  # the loser did not even count as an attempt


def test_a_stale_claim_is_retaken(arun):
    """A process killed mid-generation leaves 'running' behind with nothing to
    clear it. Without this the period would be stuck in it forever."""
    user_id = arun(_make_user("stale-claim@example.com"))
    assert arun(_claim(user_id)) is True
    # Nothing released the claim, but the cutoff has moved past it.
    assert arun(_claim(user_id, stale_before=datetime.now(timezone.utc))) is True

    status, attempts, _ = arun(_state(user_id))
    assert (status, attempts) == ("running", 2)


# --- terminal states --------------------------------------------------------

def test_empty_is_terminal(arun):
    """The case that used to leave no row at all: a period with nothing in it
    is resolved, not pending, so it is never examined again."""
    user_id = arun(_make_user("empty@example.com"))
    arun(_claim(user_id))
    arun(db.finish_report(user_id, "week", WEEK_START, status="empty"))

    status, _, started_at = arun(_state(user_id))
    assert status == "empty"
    assert started_at is None
    assert arun(_claim(user_id)) is False


def test_failure_is_retried_until_the_attempt_ceiling(arun):
    user_id = arun(_make_user("retries@example.com"))
    for expected in range(1, MAX_ATTEMPTS + 1):
        assert arun(_claim(user_id)) is True, f"attempt {expected} was refused"
        _, attempts, _ = arun(_state(user_id))
        assert attempts == expected
        arun(db.finish_report(
            user_id, "week", WEEK_START, status="failed", last_error="boom"
        ))

    # Ceiling reached: left alone rather than retried every hour.
    assert arun(_claim(user_id)) is False
    status, attempts, _ = arun(_state(user_id))
    assert (status, attempts) == ("failed", MAX_ATTEMPTS)


def test_failure_keeps_its_reason_for_after_the_logs_rotate(arun):
    user_id = arun(_make_user("why@example.com"))
    arun(_claim(user_id))
    arun(db.finish_report(
        user_id, "week", WEEK_START, status="failed", last_error="RateLimitError: 429"
    ))

    assert arun(_rows(user_id))[0].last_error == "RateLimitError: 429"


# --- storing the report -----------------------------------------------------

def test_saving_updates_the_claimed_row_rather_than_inserting(arun):
    """save_report runs *after* claim_report has written the row. An insert
    here would trip uq_report_user_period_start and throw away the report that
    was just paid for."""
    user_id = arun(_make_user("save@example.com"))
    arun(_claim(user_id))

    saved = arun(db.save_report(
        user_id=user_id,
        period="week",
        period_start=WEEK_START,
        period_end=WEEK_END,
        avg_productivity=4.25,
        active_days=5,
        final_report={"title": "A week"},
        tokens_used=1234,
        generation_time=2.5,
    ))

    assert saved.status == "ready"
    assert saved.final_report == {"title": "A week"}
    assert saved.started_at is None
    assert len(arun(_rows(user_id))) == 1, "the claimed row was duplicated"

    # A ready period is not picked up again.
    assert arun(_claim(user_id)) is False


def test_saving_without_a_claim_still_works(arun):
    """Notebooks and the evaluation harness write reports without claiming."""
    user_id = arun(_make_user("noclaim@example.com"))
    saved = arun(db.save_report(
        user_id=user_id,
        period="month",
        period_start=date(2026, 7, 1),
        period_end=date(2026, 7, 31),
        avg_productivity=None,
        active_days=0,
        final_report={"title": "July"},
    ))
    assert saved.status == "ready"


def test_regenerating_clears_the_previous_attempts_error(arun):
    user_id = arun(_make_user("regen@example.com"))
    arun(_claim(user_id))
    arun(db.finish_report(
        user_id, "week", WEEK_START, status="failed", last_error="boom"
    ))
    arun(_claim(user_id))

    saved = arun(db.save_report(
        user_id=user_id,
        period="week",
        period_start=WEEK_START,
        period_end=WEEK_END,
        avg_productivity=3.0,
        active_days=2,
        final_report={"title": "second time lucky"},
    ))
    assert saved.status == "ready"
    assert saved.last_error is None


# --- what the scheduler reads -----------------------------------------------

def test_report_states_says_nothing_about_an_unseen_period(arun):
    user_id = arun(_make_user("unseen@example.com"))
    assert arun(_state(user_id)) is None


def test_report_states_keeps_users_apart(arun):
    """One batch query serves every user, so the per-user key must be exact —
    otherwise one user's report would mark another's period as done."""
    alice = arun(_make_user("alice-claims@example.com"))
    bob = arun(_make_user("bob-claims@example.com"))

    assert arun(_claim(alice)) is True

    states = arun(db.report_states({("week", WEEK_START)}))
    assert (alice, "week", WEEK_START) in states
    assert (bob, "week", WEEK_START) not in states
    assert arun(_claim(bob)) is True  # Alice's claim does not block Bob
