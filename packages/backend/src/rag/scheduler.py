"""APScheduler setup for automatic report generation.

Reports are generated per user, on that user's own calendar. A single job
runs every hour and asks, for each user and each of week/month/year: has that
period ended in *their* timezone, and is it past ``REPORT_LOCAL_HOUR`` there?
Everyone therefore gets their report on the morning after their own period
ends, whether they live in Kyiv or Vancouver.

The job is level-triggered, not edge-triggered — it looks at the state of the
world ("this period is over and has no report") rather than at a moment in
time ("it is now Monday 00:01"). Three things fall out of that:

  - it is its own catch-up. A server down for half a day generates everything
    it missed on the next tick, so no separate startup backfill and no
    misfire-grace juggling.
  - it survives DST. In countries that shift the clock at midnight, local
    00:00 does not exist on one day a year; a job keyed to that instant would
    silently skip a week.
  - it cannot race the entry edit window. Both read the same
    ``src.core.periods`` helpers, so an entry stops being editable exactly
    when its period closes, which is never later than the report.

The scheduler is started / stopped via FastAPI lifespan in ``src/api/main.py``.
"""

import asyncio
import json
import logging
from collections import defaultdict
from datetime import date, datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import delete, or_

from src.core.periods import due_report_period, resolve_tz
from src.core.push import send_push
from src.db.models import AuthCode, RefreshToken
from src.db.session import get_async_sessionmaker
from src.rag import db
from src.core.observability import get_langfuse_callbacks
from src.rag.pipeline import app as pipeline
from src.rag.state import DateDict

# Ordered so a freshly generated sub-period can feed the summary above it:
# this week's report is written before the month that contains it.
PERIODS = ("week", "month", "year")

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Limits the number of pipeline runs (LLM calls) executing at the same time.
# Remaining tasks wait in the asyncio queue until a slot is freed.
_semaphore = asyncio.Semaphore(10)

# Push notification texts for "your report is ready", keyed by report period.
# user.language stores free-form values like "Ukrainian" / "English".
_REPORT_PUSH_TEXTS = {
    "uk": {
        "title": "Звіт готовий 📊",
        "week": "Твій звіт за тиждень сформовано. Зайди подивитися!",
        "month": "Твій звіт за місяць сформовано. Зайди подивитися!",
        "year": "Твій звіт за рік сформовано. Зайди подивитися!",
    },
    "en": {
        "title": "Report ready 📊",
        "week": "Your weekly report is ready. Take a look!",
        "month": "Your monthly report is ready. Take a look!",
        "year": "Your yearly report is ready. Take a look!",
    },
}


async def _notify_report_ready(user_id: int, period: str) -> None:
    """Send a 'report is ready' push to the user, if they have a device token."""
    user = await db.get_user(user_id)
    if not user or not user.expo_push_token:
        return
    lang = "uk" if (user.language or "").lower().startswith("ukrain") else "en"
    texts = _REPORT_PUSH_TEXTS[lang]
    await send_push(
        token=user.expo_push_token,
        title=texts["title"],
        body=texts[period],
        data={"type": "report_ready", "period": period},
    )


async def _generate_one(
    user_id: int,
    period: str,
    date_dict: DateDict,
    period_start: date,
    period_end: date,
) -> None:
    """Generate and persist a single report, guarded by ``_semaphore``.

    Idempotent: does nothing when the report already exists (so overlapping
    ticks are harmless) or when the user has no entries in the period (no LLM
    call for inactive users). The ``report_exists`` check duplicates the batch
    filter in :func:`generate_due_reports` on purpose — the batch snapshot is
    taken before any generation starts, and a slow tick can still be running
    when the next one begins.
    """
    async with _semaphore:
        try:
            if await db.report_exists(user_id, period, period_start):
                return

            if await db.count_entries(period, date_dict, user_id) == 0:
                logger.info(
                    "Skipping report for user=%s period=%s date=%s: no entries",
                    user_id, period, date_dict,
                )
                return

            state = await pipeline.ainvoke(
                {
                    "period": period,
                    "date": date_dict,
                    "user_id": user_id,
                },
                # Callbacks propagate through LangGraph to every nested LLM call
                # (create_report, the parallel summarizer calls) so the whole run
                # lands in one trace. user_id/period are non-content dimensions for
                # slicing cost & latency; the diary text in the prompts is masked
                # by the client's global mask. Empty callbacks = Langfuse disabled.
                config={
                    "callbacks": get_langfuse_callbacks(),
                    "metadata": {
                        "langfuse_user_id": str(user_id),
                        "langfuse_tags": [f"period:{period}"],
                    },
                },
            )
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
                # Measured by the create_report node; until now the pipeline
                # computed both and dropped them on the floor.
                tokens_used=state.get("tokens_used"),
                generation_time=state.get("generation_time"),
            )
            await _notify_report_ready(user_id, period)
        except Exception:
            logger.exception("Failed to generate report for user=%s period=%s", user_id, period)


async def _generate_for_user(user_id: int, due: list[tuple]) -> None:
    """Run one user's due periods in order, week → month → year.

    Sequential per user so a week report written on this tick is already in
    the DB when the month report that summarises it is generated. Different
    users still run concurrently; ``_semaphore`` caps total LLM concurrency.
    """
    for period, date_dict, start, end in sorted(due, key=lambda job: PERIODS.index(job[0])):
        await _generate_one(user_id, period, date_dict, start, end)


async def generate_due_reports() -> None:
    """Hourly job — write every report whose period has closed for its owner.

    "Closed" is evaluated in each user's own timezone, so this fires for a
    Kyiv user roughly nine hours before it fires for a Vancouver one, on the
    same calendar boundary.
    """
    users = await db.get_all_users()
    if not users:
        return

    due: list[tuple[int, str, DateDict, date, date]] = []
    for user in users:
        tz = resolve_tz(user.timezone)
        for period in PERIODS:
            found = due_report_period(period, tz)
            if found is None:
                continue  # still inside the period, or before REPORT_LOCAL_HOUR
            date_dict, start, end = found
            due.append((user.id, period, date_dict, start, end))

    if not due:
        return

    # A single query for "which of these already exist". Every user shares the
    # same handful of (period, period_start) pairs, so this is one round trip
    # per tick instead of three per user — the difference between ~70 queries
    # an hour and ~70k at scale.
    existing = await db.existing_report_keys({(period, start) for _, period, _, start, _ in due})

    by_user: dict[int, list[tuple]] = defaultdict(list)
    for user_id, period, date_dict, start, end in due:
        if (user_id, period, start) in existing:
            continue
        by_user[user_id].append((period, date_dict, start, end))

    if not by_user:
        return

    logger.info(
        "Report tick: %s period(s) due across %s user(s)",
        sum(len(jobs) for jobs in by_user.values()), len(by_user),
    )
    await asyncio.gather(*[_generate_for_user(uid, jobs) for uid, jobs in by_user.items()])


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


def register_jobs() -> None:
    """Register all jobs on the module-level ``scheduler`` instance.

    Call once during application startup (before ``scheduler.start()``).
    """
    # Every hour at :05. No misfire grace and no separate catch-up job: the
    # tick is idempotent and recomputes what is due from scratch, so a missed
    # firing costs at most an hour's delay and the next one repairs it.
    scheduler.add_job(
        generate_due_reports,
        CronTrigger(minute=5),
        # A tick that overruns the hour must not have a second copy start
        # alongside it — both would generate the same reports.
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(cleanup_auth_artifacts, CronTrigger(hour=3, minute=0),
                      misfire_grace_time=3600)
    # Run once at startup too, so a deploy does not wait up to an hour to
    # generate whatever came due while the server was down.
    scheduler.add_job(generate_due_reports)
