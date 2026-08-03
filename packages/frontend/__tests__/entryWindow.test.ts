import { fromIsoDate, toIsoDate, todayIso } from '@/utils/date';
import { isEntryEditable, weekEnd } from '@/utils/entryWindow';

describe('toIsoDate', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 local. toISOString() would roll this to the next day for anyone
    // east of UTC — which is what used to file late-evening notes under
    // tomorrow's date, and so under the wrong week's report.
    const late = new Date(2026, 7, 5, 23, 30);
    expect(toIsoDate(late)).toBe('2026-08-05');
  });

  it('zero-pads month and day', () => {
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('fromIsoDate', () => {
  it('parses to local midnight, so the day survives the round trip', () => {
    // new Date('2026-08-05') is UTC midnight, which is 2026-08-04 west of UTC.
    expect(toIsoDate(fromIsoDate('2026-08-05'))).toBe('2026-08-05');
  });
});

describe('weekEnd', () => {
  it('returns the Sunday of the entry’s own ISO week', () => {
    expect(weekEnd('2026-08-03')).toBe('2026-08-09'); // Monday
    expect(weekEnd('2026-08-05')).toBe('2026-08-09'); // Wednesday
  });

  it('leaves a Sunday on itself rather than jumping a week', () => {
    expect(weekEnd('2026-08-09')).toBe('2026-08-09');
  });

  it('crosses a month boundary', () => {
    // Wed 2026-07-29 → Sun 2026-08-02.
    expect(weekEnd('2026-07-29')).toBe('2026-08-02');
  });

  it('crosses a year boundary', () => {
    // Wed 2025-12-31 → Sun 2026-01-04.
    expect(weekEnd('2025-12-31')).toBe('2026-01-04');
  });
});

describe('isEntryEditable', () => {
  it('allows an entry written today', () => {
    expect(isEntryEditable({ date_note: todayIso() })).toBe(true);
  });

  it('allows an entry from earlier in the current week', () => {
    const monday = fromIsoDate(todayIso());
    monday.setDate(monday.getDate() - ((monday.getDay() === 0 ? 7 : monday.getDay()) - 1));
    expect(isEntryEditable({ date_note: toIsoDate(monday) })).toBe(true);
  });

  it('locks an entry from a week that has ended', () => {
    const lastWeek = fromIsoDate(todayIso());
    lastWeek.setDate(lastWeek.getDate() - 7);
    expect(isEntryEditable({ date_note: toIsoDate(lastWeek) })).toBe(false);
  });

  it('stays open through the last day of the week', () => {
    const sunday = fromIsoDate(weekEnd(todayIso()));
    expect(isEntryEditable({ date_note: toIsoDate(sunday) })).toBe(true);
  });
});
