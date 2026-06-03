import { Entry } from '@/db/types';
import { apiFetch } from './client';

export interface RemoteEntry {
  id: number;
  goal_id: number;
  date_note: string;
  note: string;
  productivity_score: number;
}

export async function listEntries(limit = 100, offset = 0): Promise<RemoteEntry[]> {
  const res = await apiFetch(`/entries?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to list entries: ${res.status}`);
  return res.json();
}

export async function createEntry(
  entry: Omit<Entry, 'id' | 'remote_id' | 'synced' | 'goal_id'>,
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
    }),
  });

  if (!res.ok) throw new Error(`Failed to create entry: ${res.status}`);
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

  if (!res.ok) throw new Error(`Failed to update entry: ${res.status}`);
}
