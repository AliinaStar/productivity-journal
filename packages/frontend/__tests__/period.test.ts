/**
 * Note on the two timezone cases below ("west of UTC", "on its own dates"):
 * they only *fail* on a host behind UTC, because that is the only place the
 * bug they guard shows up. Run them with TZ=America/Vancouver on CI to make
 * them bite; Node on Windows ignores TZ and always reports the system zone,
 * so locally they assert the right thing without proving it.
 */
import { periodLabel, toPeriodKey } from '@/utils/period';

describe('toPeriodKey', () => {
  it('formats a year key', () => {
    expect(toPeriodKey('year', '2026-04-07')).toBe('2026');
  });

  it('formats a month key zero-padded', () => {
    expect(toPeriodKey('month', '2026-04-07')).toBe('2026-04');
  });

  it('formats a week key with ISO week number', () => {
    // 2026-01-05 is ISO week 2 of 2026.
    expect(toPeriodKey('week', '2026-01-05')).toBe('2026-W02');
  });

  it('uses the ISO year, not the calendar year, across the new year', () => {
    // The week starting Mon 29 Dec 2025 is ISO week 1 of *2026* — that is how
    // the backend keys it too. Reading the year off the start date would file
    // it as 2025-W01.
    expect(toPeriodKey('week', '2025-12-29')).toBe('2026-W01');
    // ...and the following week is week 2, not a second week 1.
    expect(toPeriodKey('week', '2026-01-05')).toBe('2026-W02');
  });

  it('does not shift the week west of UTC', () => {
    // Mon 3 Aug 2026 is ISO week 32. Parsed as UTC midnight it reads as
    // Sunday 2 Aug on any device behind UTC, i.e. week 31.
    expect(toPeriodKey('week', '2026-08-03')).toBe('2026-W32');
  });
});

describe('periodLabel', () => {
  it('renders a week range on its own dates', () => {
    // Not the day before: a bare 'YYYY-MM-DD' parsed as UTC midnight renders
    // one day early for every device west of UTC.
    expect(periodLabel('week', '2026-08-03', '2026-08-09')).toBe('3 серп. – 9 серп.');
  });

  it('renders a month on its own month', () => {
    expect(periodLabel('month', '2026-08-01', '2026-08-31')).toBe('серпень 2026 р.');
  });

  it('renders a year', () => {
    expect(periodLabel('year', '2026-01-01', '2026-12-31')).toBe('2026');
  });
});
