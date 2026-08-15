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

# How many finished periods back a tick will still look. This is the depth of
# the catch-up: a gap older than the horizon is never repaired.
#
# It replaces a grace window measured in days, which could not do this job.
# The window bounded how long *one* period stayed on offer, but the offer was
# only ever the single most recently finished period — so once the next week
# closed, the previous one became unreachable no matter how wide the window
# was. Raising it from 7 days to ten years recovered exactly nothing.
#
# The cost the window was really guarding against — re-checking a period that
# will never produce a report, every hour forever — is handled instead by
# recording the outcome of every period we resolve (see ``ReportStatus``), so
# a period is examined once and then never again.
CATCH_UP_HORIZON = {"week": 8, "month": 3, "year": 1}

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


def closed_periods(period: str, tz: ZoneInfo) -> list[tuple[dict, date, date]]:
    """Every period of this kind that has finished in *tz*, newest first.

    Returns up to :data:`CATCH_UP_HORIZON` entries of
    ``(date_dict, period_start, period_end)`` — the most recently finished
    period, then the one before it, and so on. Empty before
    :data:`REPORT_LOCAL_HOUR` local time, which keeps the "report is ready 📊"
    push out of the small hours; a catch-up waiting until morning is fine.

    Returning the whole list rather than only the newest period is what makes
    the job self-healing in fact and not only in intent. The caller skips
    periods it has already resolved, so in the steady state exactly one entry
    here is new; after an outage, every period inside the horizon is, and the
    next tick repairs the lot.

    It is *level*-triggered, not edge-triggered: it describes the state of the
    calendar rather than a moment in it, so it is immune to the DST
    transitions that delete local midnight in some countries — a job keyed on
    "is it 00:00 there?" would silently skip a week once a year.
    """
    now = local_now(tz)
    if now.hour < REPORT_LOCAL_HOUR:
        return []

    found: list[tuple[dict, date, date]] = []
    date_dict = last_completed(period, now.date())
    for _ in range(CATCH_UP_HORIZON[period]):
        start, end = bounds_of(period, date_dict)
        found.append((date_dict, start, end))
        # Step back one period: the day before this one began belongs to the
        # previous one, whatever calendar oddity that lands on.
        date_dict = last_completed(period, start)
    return found
