import { toPeriodKey } from '@/utils/period';

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
});
