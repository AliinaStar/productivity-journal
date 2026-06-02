import type { TFunction } from 'i18next';

export type DeadlineTone = 'overdue' | 'soon' | 'normal';

export interface DeadlineInfo {
  text: string;
  tone: DeadlineTone;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDeadline(iso: string, t: TFunction): DeadlineInfo {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = startOfDay(new Date());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0)  return { text: t('deadline.overdue'),               tone: 'overdue' };
  if (diffDays === 0) return { text: t('deadline.today'),                tone: 'soon' };
  if (diffDays === 1) return { text: t('deadline.tomorrow'),             tone: 'soon' };
  const tone: DeadlineTone = diffDays <= 3 ? 'soon' : 'normal';
  return { text: t('deadline.inDays', { count: diffDays }), tone };
}
