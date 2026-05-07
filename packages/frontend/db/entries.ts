import { useSQLiteContext } from 'expo-sqlite';
import { Entry } from './types';
import { RemoteEntry } from '@/api-client/entries';

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useEntries() {
  const db = useSQLiteContext();

  async function getByGoal(goalId: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries WHERE goal_id = ? ORDER BY date_note DESC`,
      [goalId]
    );
  }

  async function getById(id: string): Promise<Entry | null> {
    return db.getFirstAsync<Entry>(
      `SELECT * FROM entries WHERE id = ?`,
      [id]
    );
  }

  async function getByDateRange(from: string, to: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries WHERE date_note BETWEEN ? AND ? ORDER BY date_note DESC`,
      [from, to]
    );
  }

  async function getByGoalAndDateRange(goalId: string, from: string, to: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries
       WHERE goal_id = ? AND date_note BETWEEN ? AND ?
       ORDER BY date_note DESC`,
      [goalId, from, to]
    );
  }

  async function create(data: {
    goalId: string;
    dateNote: string;
    note: string;
    productivityScore: number;
  }): Promise<Entry> {
    const id = genId();
    const created_at = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO entries (id, goal_id, date_note, note, productivity_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.goalId, data.dateNote, data.note, data.productivityScore, created_at]
    );

    return (await getById(id))!;
  }

  async function update(id: string, data: Partial<Pick<Entry, 'note' | 'productivity_score' | 'date_note'>>): Promise<void> {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (data.note !== undefined)               { fields.push('note = ?');               values.push(data.note); }
    if (data.productivity_score !== undefined)  { fields.push('productivity_score = ?');  values.push(data.productivity_score); }
    if (data.date_note !== undefined)           { fields.push('date_note = ?');           values.push(data.date_note); }

    if (fields.length === 0) return;

    fields.push('synced = 0');
    values.push(id);

    await db.runAsync(
      `UPDATE entries SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async function remove(id: string): Promise<void> {
    await db.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
  }

  // Called after successful sync with backend
  async function markSynced(id: string, remoteId: number): Promise<void> {
    await db.runAsync(
      `UPDATE entries SET synced = 1, remote_id = ? WHERE id = ?`,
      [remoteId, id]
    );
  }

  async function getUnsynced(): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries WHERE synced = 0 ORDER BY created_at ASC`
    );
  }

  async function getByRemoteId(remoteId: number): Promise<Entry | null> {
    return db.getFirstAsync<Entry>(
      `SELECT * FROM entries WHERE remote_id = ?`,
      [remoteId]
    );
  }

  async function upsertFromRemote(remote: RemoteEntry, localGoalId: string): Promise<void> {
    const existing = await getByRemoteId(remote.id);
    if (existing) return;
    const id = genId();
    const created_at = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO entries (id, goal_id, date_note, note, productivity_score, created_at, synced, remote_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, localGoalId, remote.date_note, remote.note, remote.productivity_score, created_at, remote.id]
    );
  }

  // Aggregate helpers for report generation
  async function getActiveDaysInRange(from: string, to: string): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT date_note) as count
       FROM entries WHERE date_note BETWEEN ? AND ?`,
      [from, to]
    );
    return result?.count ?? 0;
  }

  async function getAvgScoreInRange(from: string, to: string): Promise<number | null> {
    const result = await db.getFirstAsync<{ avg: number | null }>(
      `SELECT AVG(productivity_score) as avg
       FROM entries WHERE date_note BETWEEN ? AND ?`,
      [from, to]
    );
    return result?.avg ?? null;
  }

  async function clearAll(): Promise<void> {
    await db.runAsync(`DELETE FROM entries`);
  }

  return {
    getByGoal,
    getById,
    getByDateRange,
    getByGoalAndDateRange,
    create,
    update,
    remove,
    markSynced,
    getUnsynced,
    getByRemoteId,
    upsertFromRemote,
    clearAll,
    getActiveDaysInRange,
    getAvgScoreInRange,
  };
}
