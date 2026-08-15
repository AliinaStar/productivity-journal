import { Entry } from '@/db/types';
import { ApiError, apiFetch } from './client';

export interface RemoteEntry {
  id: number;
  goal_id: number;
  date_note: string;
  note: string;
  productivity_score: number;
  // ISO datetime, or null for entries created before the column existed.
  created_at: string | null;
  // ISO datetime of the last edit; null for rows never edited.
  updated_at: string | null;
  // Last day (YYYY-MM-DD) this entry can still be changed — the Sunday of its
  // own week, resolved in the account's timezone. The server enforces the same
  // boundary on PATCH and DELETE.
  editable_until: string;
}

export async function listEntries(limit = 100, offset = 0): Promise<RemoteEntry[]> {
  const res = await apiFetch(`/entries?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to list entries: ${res.status}`);
  return res.json();
}

export async function createEntry(
  entry: Omit<Entry, 'remote_id' | 'synced' | 'goal_id'>,
  remoteGoalId: number,
): Promise<RemoteEntry> {
  const res = await apiFetch('/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal_id:            remoteGoalId,
      date_note:          entry.date_note,
      note:               entry.note,
      productivity_score: entry.productivity_score,
      // The device's real write time. For entries created offline this is
      // the only honest record of when the note was written — the server
      // otherwise stamps its own sync-time clock.
      created_at:         entry.created_at,
      // The local row id, which makes this POST safe to repeat. Without it a
      // create that succeeded but whose response never arrived is sent again
      // on the next sync and becomes a second entry.
      client_id:          entry.id,
    }),
  });

  if (!res.ok) throw new ApiError(res.status, `Failed to create entry: ${res.status}`);
  return res.json();
}

export async function updateEntry(
  remoteId: number,
  data: Partial<Pick<Entry, 'note' | 'productivity_score' | 'date_note'>>,
): Promise<void> {
  const res = await apiFetch(`/entries/${remoteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // 403 means the entry's week closed before the edit reached the server.
  if (!res.ok) throw new ApiError(res.status, `Failed to update entry: ${res.status}`);
}

export async function deleteEntry(remoteId: number): Promise<void> {
  const res = await apiFetch(`/entries/${remoteId}`, { method: 'DELETE' });

  // 404 means it is already gone — the outcome we wanted, so not an error.
  if (res.status === 404) return;
  if (!res.ok) throw new ApiError(res.status, `Failed to delete entry: ${res.status}`);
}
