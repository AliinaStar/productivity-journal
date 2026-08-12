import { PeriodType } from '@/db/types';
import { fromIsoDate } from './date';

/**
 * ISO year and week number of the week containing *d*.
 *
 * Returns both together because they are not independent: the ISO year is
 * the calendar year of that week's *Thursday*, which is why the week starting
 * 29 Dec 2025 is week 1 of 2026, not of 2025. Reading the year off the
 * original date instead files that week under the wrong year — and the
 * backend keys the very same week as ISO year 2026 (`identify` in
 * `src/core/periods.py`), so the two would disagree.
 */
function isoYearWeek(d: Date): { year: number; week: number } {
  const thursday = new Date(d);
  thursday.setHours(0, 0, 0, 0);
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7));
  const week1 = new Date(thursday.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    );
  return { year: thursday.getFullYear(), week };
}

/**
 * Cache key for one report period.
 *
 * Dates arrive from the API as 'YYYY-MM-DD' and are parsed with `fromIsoDate`,
 * not `new Date(iso)`: the latter reads a bare date string as *UTC* midnight,
 * while every getter below reads local time. West of UTC that lands on the
 * previous day, so a week starting Monday is read as starting Sunday and
 * numbered one week early. Now that the server resolves periods in the user's
 * own zone, that is a real device, not a hypothetical one.
 */
export function toPeriodKey(periodType: PeriodType, periodStart: string): string {
  const d = fromIsoDate(periodStart);
  if (periodType === 'year') return String(d.getFullYear());
  if (periodType === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const { year, week } = isoYearWeek(d);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Human-readable period range, e.g. '3 серп. – 9 серп.'. */
export function periodLabel(periodType: PeriodType, periodStart: string, periodEnd: string): string {
  if (periodType === 'year') return fromIsoDate(periodStart).getFullYear().toString();
  if (periodType === 'month') {
    return fromIsoDate(periodStart).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
  }
  const s = fromIsoDate(periodStart).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const e = fromIsoDate(periodEnd).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  return `${s} – ${e}`;
}
