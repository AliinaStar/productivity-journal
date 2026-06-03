import { formatDeadline } from '@/utils/deadline';

// The component passes i18next's t(); here we stub it to echo the key.
const t = ((key: string) => key) as any;

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('formatDeadline', () => {
  it('flags an overdue date', () => {
    expect(formatDeadline(isoOffset(-2), t).tone).toBe('overdue');
  });

  it('flags today and tomorrow as soon', () => {
    expect(formatDeadline(isoOffset(0), t).tone).toBe('soon');
    expect(formatDeadline(isoOffset(1), t).tone).toBe('soon');
  });

  it('treats <= 3 days away as soon, further as normal', () => {
    expect(formatDeadline(isoOffset(3), t).tone).toBe('soon');
    expect(formatDeadline(isoOffset(10), t).tone).toBe('normal');
  });
});
