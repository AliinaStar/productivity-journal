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

// Запит на генерацію звіту (бекенд запускає RAG pipeline)
export async function requestReport(period: PeriodType, periodStart: string, periodEnd: string): Promise<RemoteReport> {
  const res = await apiFetch('/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, period_start: periodStart, period_end: periodEnd }),
  });

  if (!res.ok) throw new Error(`Failed to generate report: ${res.status}`);
  return res.json();
}

// Отримати список всіх збережених звітів певного типу
export async function listReports(period: PeriodType): Promise<RemoteReport[]> {
  const res = await apiFetch(`/reports/list?period=${period}`);
  if (!res.ok) throw new Error(`Failed to list reports: ${res.status}`);
  return res.json();
}

// Отримати вже збережений звіт з бекенду
export async function fetchReport(period: PeriodType, periodStart: string): Promise<RemoteReport | null> {
  const res = await apiFetch(`/reports?period=${period}&period_start=${periodStart}`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}
