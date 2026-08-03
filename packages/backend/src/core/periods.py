"""Period boundaries, resolved in the user's own timezone.

Single source of truth for two questions that must never disagree:

  - "Can this entry still be edited?"                  → ``routes/entries.py``
  - "Has this period ended, so its report can be
     generated?"                                       → ``rag/scheduler.py``

Both reduce to the same thing: in *this user's* timezone, is the period
containing a given date over yet? One implementation is what guarantees the
edit window closes before the report exists. Computed separately — say, an
edit window in local time against a report generated on a fixed UTC cron —
the two drift apart by the UTC offset, and a user west of UTC could rewrite
an entry that had already been summarised.

Everything here is pure: it takes dates and a timezone and returns dates.
No DB, no I/O.
"""

from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

UTC = ZoneInfo("UTC")

# Hour, in the user's own local time, at or after which a finished period's
# report may be generated. A period closes at local midnight; without this
# gate the report — and its "report is ready 📊" push — would land at 00:0x.
REPORT_LOCAL_HOUR = 8

# How long after a period ends the hourly job keeps offering to generate its
# report. Bounds the retry window: without it, "last completed year" stays due
# every hour for twelve months, so every user who wrote nothing last year gets
# re-checked ~8700 times for a report that will never exist. A week of hourly
# retries is far more downtime than the old weekly cron ever tolerated.
REPORT_GRACE_DAYS = 7

# A DateDict (see ``src/rag/state.py``) identifies one period:
#   week  → {"year": 2026, "week": 31}   (ISO year + ISO week)
#   month → {"year": 2026, "month": 8}
#   year  → {"year": 2026}
# Typed as a plain dict here so this module stays free of RAG imports.


def is_known_timezone(name: str) -> bool:
    """True if *name* is an IANA zone this machine can resolve."""
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


def resolve_tz(name: str | None) -> ZoneInfo:
    """Return a user's timezone, falling back to UTC.

    NULL is the normal case, not an error: accounts created before the column
    existed, and clients that have not synced their zone yet. Those users keep
    behaving exactly as they did when everything ran on UTC.
    """
    if not name:
        return UTC
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("Unknown timezone %r, falling back to UTC", name)
        return UTC


def local_now(tz: ZoneInfo) -> datetime:
    """Current wall-clock time in *tz*."""
    return datetime.now(tz)


def today_in(tz: ZoneInfo) -> date:
    """Current calendar date in *tz*."""
    return local_now(tz).date()


def bounds_containing(period: str, day: date) -> tuple[date, date]:
    """First and last day of the ``week``/``month``/``year`` containing *day*."""
    if period == "week":
        start = day - timedelta(days=day.isoweekday() - 1)
        return start, start + timedelta(days=6)
    if period == "month":
        last = calendar.monthrange(day.year, day.month)[1]
        return day.replace(day=1), day.replace(day=last)
    return date(day.year, 1, 1), date(day.year, 12, 31)


def bounds_of(period: str, date_dict: dict) -> tuple[date, date]:
    """First and last day of the period identified by a DateDict."""
    if period == "week":
        # fromisocalendar, not a plain date: ISO week 1 can start in late
        # December, so the ISO year is not always the calendar year.
        start = datetime.fromisocalendar(date_dict["year"], date_dict["week"], 1).date()
        return start, start + timedelta(days=6)
    if period == "month":
        return bounds_containing("month", date(date_dict["year"], date_dict["month"], 1))
    return bounds_containing("year", date(date_dict["year"], 1, 1))


def identify(period: str, day: date) -> dict:
    """DateDict for the period containing *day*."""
    if period == "week":
        iso = day.isocalendar()
        # 'isoyear', not the calendar year: 2025-12-29 belongs to ISO week 1
        # of 2026, and the report row must be keyed the same way the entry
        # query filters (``extract('isoyear', ...)``).
        return {"year": iso.year, "week": iso.week}
    if period == "month":
        return {"year": day.year, "month": day.month}
    return {"year": day.year}


def last_completed(period: str, today: date) -> dict:
    """DateDict of the most recent period that fully ended before *today*.

    Uniform across all three periods: step back one day from the start of the
    current period and read off whichever period that day lands in.
    """
    start, _ = bounds_containing(period, today)
    return identify(period, start - timedelta(days=1))


def is_period_open(period: str, day: date, tz: ZoneInfo) -> bool:
    """True while the period containing *day* has not yet ended in *tz*.

    This is the entry edit window: an entry stays editable until the end of
    its own week, because that is the week whose report will quote it.
    """
    _, end = bounds_containing(period, day)
    return today_in(tz) <= end


def due_report_period(period: str, tz: ZoneInfo) -> tuple[dict, date, date] | None:
    """The last completed period, while it is both safe and still worth
    reporting on in *tz*.

    Returns ``(date_dict, period_start, period_end)``, or ``None`` when it is
    too early (before :data:`REPORT_LOCAL_HOUR` local time) or too late (more
    than :data:`REPORT_GRACE_DAYS` past the period's end).

    Within that window it is *level*-triggered, not edge-triggered: it keeps
    returning the same period, and the caller skips periods whose report
    already exists. That is what makes the hourly job self-healing (a server
    down for six hours simply catches up on the next tick) and immune to the
    DST transitions that delete local midnight in some countries — a job keyed
    on "is it 00:00 there?" would silently skip a week once a year.
    """
    now = local_now(tz)
    if now.hour < REPORT_LOCAL_HOUR:
        return None
    date_dict = last_completed(period, now.date())
    start, end = bounds_of(period, date_dict)
    if now.date() > end + timedelta(days=REPORT_GRACE_DAYS):
        return None
    return date_dict, start, end
