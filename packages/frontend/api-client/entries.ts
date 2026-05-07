import { Entry } from '@/db/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export interface RemoteEntry {
  id: number;
  goal_id: number;
  date_note: string;
  note: string;
  productivity_score: number;
}

export async function listEntries(userId: number): Promise<RemoteEntry[]> {
  const res = await fetch(`${BASE_URL}/entries`, {
    headers: { 'X-User-ID': String(userId) },
  });
  if (!res.ok) throw new Error(`Failed to list entries: ${res.status}`);
  return res.json();
}

export async function createEntry(
  entry: Omit<Entry, 'id' | 'remote_id' | 'synced' | 'goal_id'>,
  remoteGoalId: number,
  userId: number,
): Promise<RemoteEntry> {
  const res = await fetch(`${BASE_URL}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
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
  userId: number,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/entries/${remoteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Failed to update entry: ${res.status}`);
}
