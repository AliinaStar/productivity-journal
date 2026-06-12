"""APScheduler setup for automatic report generation.

Schedules three cron jobs — week, month, year — each of which calls
``generate_reports_for_period`` for all active users.

The scheduler is started / stopped via FastAPI lifespan in ``src/api/main.py``.

Cron schedule (UTC):
  - week:  Monday 00:01  — generates report for the just-finished week
  - month: 1st of month 00:01 — generates report for the just-finished month
  - year:  1 Jan 00:01  — generates report for the just-finished year
"""

import asyncio
import json
import logging
from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import delete, or_

from src.db.models import AuthCode, RefreshToken
from src.db.session import get_async_sessionmaker
from src.rag import db
from src.rag.pipeline import app as pipeline
from src.rag.state import DateDict

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Limits the number of pipeline runs (LLM calls) executing at the same time.
# Remaining tasks wait in the asyncio queue until a slot is freed.
_semaphore = asyncio.Semaphore(10)


async def _generate_one(user_id: int, period: str, date_dict: DateDict) -> None:
    """Generate and persist a single report, guarded by ``_semaphore``.

    Idempotent: does nothing when the report already exists (so cron retries
    and the startup catch-up can safely overlap) or when the user has no
    entries in the period (no LLM call for inactive users).
    """
    async with _semaphore:
        try:
            period_start, period_end = _period_dates(period, date_dict)
            if await db.report_exists(user_id, period, period_start):
                return

            if await db.count_entries(period, date_dict, user_id) == 0:
                logger.info(
                    "Skipping report for user=%s period=%s date=%s: no entries",
                    user_id, period, date_dict,
                )
                return

            state = await pipeline.ainvoke({
                "period": period,
                "date": date_dict,
                "user_id": user_id,
            })
            if not state or not state.get("final_report"):
                logger.warning("No report generated for user=%s period=%s date=%s", user_id, period, date_dict)
                return

            await db.save_report(
                user_id=user_id,
                period=period,
                period_start=period_start,
                period_end=period_end,
                avg_productivity=state.get("avg_productivity"),
                active_days=state.get("active_days", 0),
                final_report=json.loads(state["final_report"]),
            )
        except Exception:
            logger.exception("Failed to generate report for user=%s period=%s", user_id, period)


async def generate_reports_for_period(period: str, date_dict: DateDict) -> None:
    """Generate and persist reports for *all* users for a given period.

    Fetches every user from the DB, then fires one ``_generate_one`` task
    per user. All tasks run concurrently but are throttled to 10 at a time
    via ``_semaphore``.
    """
    users = await db.get_all_users()
    await asyncio.gather(*[_generate_one(u.id, period, date_dict) for u in users])


def _period_dates(period: str, date_dict: DateDict) -> tuple[date, date]:
    """Compute (period_start, period_end) from a DateDict."""
    if period == "week":
        start = datetime.fromisocalendar(date_dict["year"], date_dict["week"], 1).date()
        return start, start + timedelta(days=6)
    elif period == "month":
        import calendar
        start = date(date_dict["year"], date_dict["month"], 1)
        last_day = calendar.monthrange(date_dict["year"], date_dict["month"])[1]
        return start, date(date_dict["year"], date_dict["month"], last_day)
    else:
        return date(date_dict["year"], 1, 1), date(date_dict["year"], 12, 31)


async def _run_weekly() -> None:
    """Cron callback — generate reports for the just-finished week."""
    yesterday = date.today() - timedelta(days=1)
    iso = yesterday.isocalendar()
    await generate_reports_for_period("week", {"year": iso.year, "week": iso.week})


async def _run_monthly() -> None:
    """Cron callback — generate reports for the just-finished month."""
    yesterday = date.today() - timedelta(days=1)
    await generate_reports_for_period(
        "month", {"year": yesterday.year, "month": yesterday.month}
    )


async def _run_yearly() -> None:
    """Cron callback — generate reports for the just-finished year."""
    yesterday = date.today() - timedelta(days=1)
    await generate_reports_for_period("year", {"year": yesterday.year})


async def cleanup_auth_artifacts() -> None:
    """Delete spent OTP codes and dead refresh tokens.

    Removes used/expired ``auth_code`` rows and expired/revoked
    ``refresh_token`` rows so neither table grows unbounded.
    """
    now = datetime.now(timezone.utc)
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        await session.execute(
            delete(AuthCode).where(or_(AuthCode.used.is_(True), AuthCode.expires_at < now))
        )
        await session.execute(
            delete(RefreshToken).where(
                or_(RefreshToken.revoked.is_(True), RefreshToken.expires_at < now)
            )
        )
        await session.commit()


async def catch_up_missed_reports() -> None:
    """Backfill reports for the most recent completed week, month, and year.

    Runs once on startup. If the server was down when a cron fired, that
    period's reports would otherwise be lost forever. ``_generate_one`` skips
    users whose report already exists or who had no entries, so on a normal
    startup this costs one cheap query per user and generates nothing.

    Ordered week → month → year so a freshly backfilled sub-period can feed
    the higher-level summary.
    """
    today = date.today()

    # Most recent completed ISO week = the week containing last Sunday.
    last_sunday = today - timedelta(days=today.isoweekday())
    iso = last_sunday.isocalendar()
    await generate_reports_for_period("week", {"year": iso.year, "week": iso.week})

    last_month_day = today.replace(day=1) - timedelta(days=1)
    await generate_reports_for_period(
        "month", {"year": last_month_day.year, "month": last_month_day.month}
    )

    await generate_reports_for_period("year", {"year": today.year - 1})


# If the server is down when a cron fires, still run the job up to 12 hours
# late instead of silently dropping it. Anything older is handled by the
# startup catch-up job.
_MISFIRE_GRACE = 12 * 3600


def register_jobs() -> None:
    """Register all cron jobs on the module-level ``scheduler`` instance.

    Call once during application startup (before ``scheduler.start()``).
    """
    scheduler.add_job(_run_weekly,  CronTrigger(day_of_week="mon", hour=0, minute=1),
                      misfire_grace_time=_MISFIRE_GRACE)
    scheduler.add_job(_run_monthly, CronTrigger(day=1,              hour=0, minute=1),
                      misfire_grace_time=_MISFIRE_GRACE)
    scheduler.add_job(_run_yearly,  CronTrigger(month=1,  day=1,    hour=0, minute=1),
                      misfire_grace_time=_MISFIRE_GRACE)
    scheduler.add_job(cleanup_auth_artifacts, CronTrigger(hour=3, minute=0),
                      misfire_grace_time=3600)
    # One-off: backfill anything missed while the server was down.
    scheduler.add_job(catch_up_missed_reports)
