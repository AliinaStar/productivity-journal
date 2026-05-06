"""APScheduler setup for automatic report generation.

Schedules three cron jobs — week, month, year — each of which calls
``generate_reports_for_period`` for all active users.

The scheduler is started / stopped via FastAPI lifespan in ``src/api/main.py``::

    async with lifespan(app):
        scheduler.start()
        yield
        scheduler.shutdown()

Cron schedule (UTC):
  - week:  Monday 00:01  — generates report for the just-finished week
  - month: 1st of month 00:01 — generates report for the just-finished month
  - year:  1 Jan 00:01  — generates report for the just-finished year
"""

import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.rag.state import DateDict


scheduler = AsyncIOScheduler()

# Limits the number of pipeline runs (LLM calls) executing at the same time.
# Remaining tasks wait in the asyncio queue until a slot is freed.
_semaphore = asyncio.Semaphore(10)


async def _generate_one(user_id: int, period: str, date: DateDict) -> None:
    """Generate and persist a single report, guarded by ``_semaphore``.

    Acquires a semaphore slot before invoking the pipeline so no more than
    10 LLM calls run concurrently. Callers that exceed the limit wait in the
    asyncio queue until a slot is freed.

    Args:
        user_id: Target user.
        period:  One of ``'week'``, ``'month'``, ``'year'``.
        date:    Period identifier passed directly to the pipeline.
    """
    async with _semaphore:
        raise NotImplementedError  # invoke pipeline + save Report row


async def generate_reports_for_period(period: str, date: DateDict) -> None:
    """Generate and persist reports for *all* users for a given period.

    Fetches every user from the DB, then fires one ``_generate_one`` task
    per user. All tasks run concurrently but are throttled to 10 at a time
    via ``_semaphore``.

    Args:
        period: One of ``'week'``, ``'month'``, ``'year'``.
        date:   Period identifier (year + week / month as applicable).
                Computed automatically by the scheduled jobs; passed
                explicitly when called from the manual-trigger endpoint.
    """
    raise NotImplementedError  # fetch users, gather _generate_one tasks


async def _run_weekly() -> None:
    """Cron callback — compute current ISO week and call generate_reports_for_period."""
    raise NotImplementedError


async def _run_monthly() -> None:
    """Cron callback — compute current month and call generate_reports_for_period."""
    raise NotImplementedError


async def _run_yearly() -> None:
    """Cron callback — compute current year and call generate_reports_for_period."""
    raise NotImplementedError


def register_jobs() -> None:
    """Register all cron jobs on the module-level ``scheduler`` instance.

    Call once during application startup (before ``scheduler.start()``).
    """
    scheduler.add_job(_run_weekly,  CronTrigger(day_of_week="mon", hour=0, minute=1))
    scheduler.add_job(_run_monthly, CronTrigger(day=1,              hour=0, minute=1))
    scheduler.add_job(_run_yearly,  CronTrigger(month=1,  day=1,    hour=0, minute=1))
