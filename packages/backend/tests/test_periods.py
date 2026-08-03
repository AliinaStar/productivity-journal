"""Unit tests for ``src.core.periods`` — pure date maths, no DB, no LLM.

These cover the two behaviours that must agree with each other: how long an
entry stays editable, and when a period is finished enough to report on. Both
are timezone-sensitive, so most tests pin "now" by monkeypatching
``periods.local_now`` — the single clock every other function here reads.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from src.core import periods

KYIV = ZoneInfo("Europe/Kyiv")          # UTC+2/+3, east of UTC
VANCOUVER = ZoneInfo("America/Vancouver")  # UTC-7/-8, west of UTC
KATHMANDU = ZoneInfo("Asia/Kathmandu")  # UTC+5:45, a fractional offset


@pytest.fixture()
def frozen(monkeypatch):
    """Pin the wall clock. Call with a naive datetime = local time in *tz*."""
    def _freeze(local: datetime):
        monkeypatch.setattr(
            periods, "local_now", lambda tz: local.replace(tzinfo=tz)
        )
    return _freeze


# --- bounds -----------------------------------------------------------------

def test_bounds_of_week():
    # ISO week 2 of 2026 starts Mon 2026-01-05.
    assert periods.bounds_of("week", {"year": 2026, "week": 2}) == (
        date(2026, 1, 5), date(2026, 1, 11)
    )


def test_bounds_of_month():
    assert periods.bounds_of("month", {"year": 2026, "month": 2}) == (
        date(2026, 2, 1), date(2026, 2, 28)
    )


def test_bounds_of_year():
    assert periods.bounds_of("year", {"year": 2026}) == (
        date(2026, 1, 1), date(2026, 12, 31)
    )


def test_bounds_containing_week_runs_monday_to_sunday():
    # 2026-08-03 is a Monday.
    assert periods.bounds_containing("week", date(2026, 8, 3)) == (
        date(2026, 8, 3), date(2026, 8, 9)
    )
    # Sunday belongs to the week that started six days earlier, not the next one.
    assert periods.bounds_containing("week", date(2026, 8, 9)) == (
        date(2026, 8, 3), date(2026, 8, 9)
    )


def test_identify_week_uses_iso_year_not_calendar_year():
    """2025-12-29 is ISO week 1 of *2026* — the entry query filters on isoyear,
    so the report row has to be keyed the same way or the two never match."""
    assert periods.identify("week", date(2025, 12, 29)) == {"year": 2026, "week": 1}


def test_bounds_of_round_trips_identify_across_the_year_boundary():
    day = date(2025, 12, 31)
    start, end = periods.bounds_of("week", periods.identify("week", day))
    assert start <= day <= end


# --- last completed period --------------------------------------------------

@pytest.mark.parametrize("today, expected", [
    (date(2026, 8, 3), {"year": 2026, "week": 31}),   # Monday: last week just ended
    (date(2026, 8, 9), {"year": 2026, "week": 31}),   # Sunday: this week is NOT over
])
def test_last_completed_week(today, expected):
    assert periods.last_completed("week", today) == expected


def test_last_completed_month_and_year():
    assert periods.last_completed("month", date(2026, 8, 3)) == {"year": 2026, "month": 7}
    assert periods.last_completed("month", date(2026, 1, 1)) == {"year": 2025, "month": 12}
    assert periods.last_completed("year", date(2026, 8, 3)) == {"year": 2025}


# --- the edit window --------------------------------------------------------

def test_entry_stays_editable_through_its_own_sunday(frozen):
    entry_day = date(2026, 8, 5)  # Wednesday
    frozen(datetime(2026, 8, 9, 23, 59))  # Sunday, last minute
    assert periods.is_period_open("week", entry_day, KYIV)


def test_entry_locks_once_its_week_is_over(frozen):
    entry_day = date(2026, 8, 5)
    frozen(datetime(2026, 8, 10, 0, 1))  # Monday, just after
    assert not periods.is_period_open("week", entry_day, KYIV)


def test_edit_window_follows_the_users_own_clock(frozen, monkeypatch):
    """Same instant, two users: the Kyiv week is over, the Vancouver one is not.

    2026-08-10 04:00 UTC is Monday 07:00 in Kyiv but still Sunday 21:00 in
    Vancouver — exactly the gap a fixed UTC deadline got wrong. The margin
    holds in winter too (UTC+2 / UTC-8).
    """
    instant = datetime(2026, 8, 10, 4, 0, tzinfo=ZoneInfo("UTC"))
    monkeypatch.setattr(periods, "local_now", lambda tz: instant.astimezone(tz))

    entry_day = date(2026, 8, 5)
    assert not periods.is_period_open("week", entry_day, KYIV)
    assert periods.is_period_open("week", entry_day, VANCOUVER)


# --- when a report becomes due ----------------------------------------------

def test_report_not_due_before_the_local_report_hour(frozen):
    frozen(datetime(2026, 8, 10, periods.REPORT_LOCAL_HOUR - 1, 30))
    assert periods.due_report_period("week", KYIV) is None


def test_report_due_after_the_local_report_hour(frozen):
    frozen(datetime(2026, 8, 10, periods.REPORT_LOCAL_HOUR, 5))
    due = periods.due_report_period("week", KYIV)
    assert due is not None
    date_dict, start, end = due
    assert date_dict == {"year": 2026, "week": 32}
    assert (start, end) == (date(2026, 8, 3), date(2026, 8, 9))


def test_report_stays_due_all_day(frozen):
    """Level-triggered, not edge-triggered: a tick at 08:05 and one at 21:05
    must offer the same period, so a missed hour is never a missed report."""
    frozen(datetime(2026, 8, 10, 8, 5))
    morning = periods.due_report_period("week", KYIV)
    frozen(datetime(2026, 8, 10, 21, 5))
    evening = periods.due_report_period("week", KYIV)
    assert morning == evening


def test_report_stops_being_due_after_the_grace_window(frozen):
    """Bounds the retry window. Without it, "last completed year" stays due
    every hour for twelve months for every user who wrote nothing in it."""
    frozen(datetime(2026, 8, 10, 9, 0))  # day after week 32 ended
    assert periods.due_report_period("week", KYIV) is not None

    frozen(datetime(2026, 8, 9 + periods.REPORT_GRACE_DAYS, 9, 0))  # last day in grace
    assert periods.due_report_period("week", KYIV) is not None

    frozen(datetime(2026, 8, 10 + periods.REPORT_GRACE_DAYS, 9, 0))  # one day past
    due = periods.due_report_period("week", KYIV)
    # Not None here — by now a *newer* week has closed. What matters is that
    # the stale one is no longer being offered.
    assert due is None or due[1] != date(2026, 8, 3)


def test_stale_year_report_is_not_offered_forever(frozen):
    frozen(datetime(2026, 6, 1, 9, 0))  # mid-year: 2025 ended long ago
    assert periods.due_report_period("year", KYIV) is None

    frozen(datetime(2026, 1, 2, 9, 0))  # early January: still worth generating
    assert periods.due_report_period("year", KYIV) is not None


def test_report_due_with_a_fractional_utc_offset(frozen):
    """Kathmandu is UTC+5:45 — the hour gate must still open there."""
    frozen(datetime(2026, 8, 10, 9, 46))
    assert periods.due_report_period("week", KATHMANDU) is not None


def test_edit_window_closes_before_the_report_is_due(frozen):
    """The invariant the whole design exists for: there is no instant at which
    an entry is both still editable and already reportable."""
    entry_day = date(2026, 8, 5)
    for hour in range(24):
        for day in (9, 10):  # Sunday and Monday
            frozen(datetime(2026, 8, day, hour, 30))
            open_for_edit = periods.is_period_open("week", entry_day, KYIV)
            due = periods.due_report_period("week", KYIV)
            reportable = due is not None and due[1] == date(2026, 8, 3)
            assert not (open_for_edit and reportable)


# --- timezone resolution ----------------------------------------------------

def test_resolve_tz_defaults_to_utc_when_unknown_or_missing():
    assert periods.resolve_tz(None) is periods.UTC
    assert periods.resolve_tz("") is periods.UTC
    assert periods.resolve_tz("Mars/Olympus_Mons") is periods.UTC


def test_resolve_tz_accepts_a_real_zone():
    assert periods.resolve_tz("Europe/Kyiv") == KYIV


def test_is_known_timezone():
    assert periods.is_known_timezone("America/Vancouver")
    assert not periods.is_known_timezone("Not/AZone")
