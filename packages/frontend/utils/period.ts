import { PeriodType } from '@/db/types';

function isoWeek(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

export function toPeriodKey(periodType: PeriodType, periodStart: string): string {
  const d = new Date(periodStart);
  if (periodType === 'year') return String(d.getFullYear());
  if (periodType === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const w = isoWeek(d);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

export function periodLabel(periodType: PeriodType, periodStart: string, periodEnd: string): string {
  if (periodType === 'year') return new Date(periodStart).getFullYear().toString();
  if (periodType === 'month') {
    return new Date(periodStart).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
  }
  const s = new Date(periodStart).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const e = new Date(periodEnd).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  return `${s} – ${e}`;
}
