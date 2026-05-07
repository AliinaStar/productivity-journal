import { PeriodType } from '@/db/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

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
export async function requestReport(period: PeriodType, periodStart: string, periodEnd: string, userId: number): Promise<RemoteReport> {
  const res = await fetch(`${BASE_URL}/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
    body: JSON.stringify({ period, period_start: periodStart, period_end: periodEnd }),
  });

  if (!res.ok) throw new Error(`Failed to generate report: ${res.status}`);
  return res.json();
}

// Отримати список всіх збережених звітів певного типу
export async function listReports(period: PeriodType, userId: number): Promise<RemoteReport[]> {
  const res = await fetch(`${BASE_URL}/reports/list?period=${period}`, {
    headers: { 'X-User-ID': String(userId) },
  });
  if (!res.ok) throw new Error(`Failed to list reports: ${res.status}`);
  return res.json();
}

// Отримати вже збережений звіт з бекенду
export async function fetchReport(period: PeriodType, periodStart: string, userId: number): Promise<RemoteReport | null> {
  const res = await fetch(`${BASE_URL}/reports?period=${period}&period_start=${periodStart}`, {
    headers: { 'X-User-ID': String(userId) },
  });

  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}
