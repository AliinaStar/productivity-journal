// Mirrors backend SQLAlchemy models — embeddings are backend-only, not stored locally

export type GoalStatus = 'active' | 'postpone' | 'finished';
export type PeriodType = 'week' | 'month' | 'year';

export interface Goal {
  id: string;            // local UUID (TEXT)
  remote_id: number | null; // backend integer ID after sync
  title: string;
  description: string | null;
  deadline: string | null;  // ISO date 'YYYY-MM-DD'
  created_at: string;       // ISO date 'YYYY-MM-DD'
  status: GoalStatus;
  synced: number;           // 0 = not synced, 1 = synced
}

export interface Entry {
  id: string;            // local UUID (TEXT)
  remote_id: number | null; // backend integer ID after sync
  goal_id: string;       // local Goal UUID
  date_note: string;     // ISO date 'YYYY-MM-DD'
  note: string;
  productivity_score: number; // 1–5
  created_at: string;    // ISO datetime
  synced: number;        // 0 = not synced, 1 = synced
}

export interface ReportCache {
  id: string;
  period_type: PeriodType;
  period_key: string;    // '2025-W23' | '2025-06' | '2025'
  period_start: string;  // ISO date
  period_end: string;    // ISO date
  avg_productivity: number | null;
  active_days: number;
  data: string;          // JSONB final_report serialized as JSON string
  cached_at: string;     // ISO datetime
}

export interface SyncMeta {
  key: string;
  value: string;
}

// Sync meta keys
export const SYNC_KEYS = {
  LAST_SYNC_AT: 'last_sync_at',
  USER_REMOTE_ID: 'user_remote_id',
  TOUR_COMPLETED: 'tour_completed',
} as const;
