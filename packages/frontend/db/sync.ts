import { useSQLiteContext } from 'expo-sqlite';
import { SYNC_KEYS } from './types';

export function useSyncMeta() {
  const db = useSQLiteContext();

  async function get(key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key]
    );
    return row?.value ?? null;
  }

  async function set(key: string, value: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  async function getLastSyncAt(): Promise<string | null> {
    return get(SYNC_KEYS.LAST_SYNC_AT);
  }

  async function setLastSyncAt(isoDatetime: string): Promise<void> {
    return set(SYNC_KEYS.LAST_SYNC_AT, isoDatetime);
  }

  async function getUserRemoteId(): Promise<number | null> {
    const val = await get(SYNC_KEYS.USER_REMOTE_ID);
    return val ? Number(val) : null;
  }

  async function setUserRemoteId(remoteId: number): Promise<void> {
    return set(SYNC_KEYS.USER_REMOTE_ID, String(remoteId));
  }

  async function getTourCompleted(): Promise<boolean> {
    return (await get(SYNC_KEYS.TOUR_COMPLETED)) === '1';
  }

  async function setTourCompleted(): Promise<void> {
    return set(SYNC_KEYS.TOUR_COMPLETED, '1');
  }

  async function getReportedTimezone(): Promise<string | null> {
    return get(SYNC_KEYS.TIMEZONE);
  }

  async function setReportedTimezone(timezone: string): Promise<void> {
    return set(SYNC_KEYS.TIMEZONE, timezone);
  }

  return {
    get, set, getLastSyncAt, setLastSyncAt, getUserRemoteId, setUserRemoteId,
    getTourCompleted, setTourCompleted, getReportedTimezone, setReportedTimezone,
  };
}
