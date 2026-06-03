import { PeriodType } from '@/db/types';
import { apiFetch } from './client';

export interface RemoteReport {
  id: number;
  period: PeriodType;
  period_start: string;
  period_end: string;
  avg_productivity: number | null;
  active_days: number;
  created_at: string;
  final_report: Record<string, unknown> | null;
}

// Отримати список збережених звітів певного типу (звіти генеруються планувальником на бекенді)
export async function listReports(period: PeriodType, limit = 100, offset = 0): Promise<RemoteReport[]> {
  const res = await apiFetch(`/reports/list?period=${period}&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to list reports: ${res.status}`);
  return res.json();
}

// Отримати вже збережений звіт з бекенду
export async function fetchReport(period: PeriodType, periodStart: string): Promise<RemoteReport | null> {
  const res = await apiFetch(`/reports?period=${period}&period_start=${periodStart}`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}
