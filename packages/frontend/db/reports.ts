import { useSQLiteContext } from 'expo-sqlite';
import { ReportCache, PeriodType } from './types';

// period_key format:
//   week  → '2025-W23'
//   month → '2025-06'
//   year  → '2025'

export function useReports() {
  const db = useSQLiteContext();

  async function get(periodType: PeriodType, periodKey: string): Promise<ReportCache | null> {
    return db.getFirstAsync<ReportCache>(
      `SELECT * FROM reports_cache WHERE period_type = ? AND period_key = ?`,
      [periodType, periodKey]
    );
  }

  async function getAll(periodType: PeriodType): Promise<ReportCache[]> {
    return db.getAllAsync<ReportCache>(
      `SELECT * FROM reports_cache WHERE period_type = ? ORDER BY period_start DESC`,
      [periodType]
    );
  }

  // Saves or replaces a report received from backend
  async function upsert(report: Omit<ReportCache, 'id' | 'cached_at'>): Promise<void> {
    const id = `${report.period_type}-${report.period_key}`;
    const cached_at = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO reports_cache
         (id, period_type, period_key, period_start, period_end, avg_productivity, active_days, data, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(period_type, period_key) DO UPDATE SET
         data             = excluded.data,
         avg_productivity = excluded.avg_productivity,
         active_days      = excluded.active_days,
         cached_at        = excluded.cached_at`,
      [
        id,
        report.period_type,
        report.period_key,
        report.period_start,
        report.period_end,
        report.avg_productivity,
        report.active_days,
        report.data,
        cached_at,
      ]
    );
  }

  async function remove(periodType: PeriodType, periodKey: string): Promise<void> {
    await db.runAsync(
      `DELETE FROM reports_cache WHERE period_type = ? AND period_key = ?`,
      [periodType, periodKey]
    );
  }

  // Parse JSON data back to typed object
  function parse<T>(report: ReportCache): T {
    return JSON.parse(report.data) as T;
  }

  async function clearAll(): Promise<void> {
    await db.runAsync(`DELETE FROM reports_cache`);
  }

  return { get, getAll, upsert, remove, parse, clearAll };
}
