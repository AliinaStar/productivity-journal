import { fromIsoDate, toIsoDate, todayIso } from './date';

/**
 * How long an entry stays editable.
 *
 * Mirrors `is_period_open` in `packages/backend/src/core/periods.py`: an entry
 * can be changed or deleted until the end of the week it belongs to, because
 * that is the week whose report will quote it. The server is the authority —
 * it re-checks on every PATCH and DELETE — but the client needs the same
 * answer locally so it can hide the buttons instead of letting someone type
 * an edit that will be rejected, and so the rule still holds offline.
 */

/** Sunday of the ISO week containing *dateNote*, as 'YYYY-MM-DD'. */
export function weekEnd(dateNote: string): string {
  const d = fromIsoDate(dateNote);
  // getDay() is 0=Sunday; ISO counts Monday=1..Sunday=7.
  const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() + (7 - isoWeekday));
  return toIsoDate(d);
}

/** True while the entry's own week has not ended on this device's calendar. */
export function isEntryEditable(entry: { date_note: string }): boolean {
  // ISO dates compare correctly as strings.
  return todayIso() <= weekEnd(entry.date_note);
}
