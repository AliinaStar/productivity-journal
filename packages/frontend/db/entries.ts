import { useSQLiteContext } from 'expo-sqlite';
import { Entry } from './types';
import { RemoteEntry } from '@/api-client/entries';

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Every read filters tombstones out. A row with deleted = 1 has been removed
// as far as the user is concerned; it only survives so the next sync can tell
// the server about it (see `remove`).
const LIVE = `deleted = 0`;

export function useEntries() {
  const db = useSQLiteContext();

  async function getAll(): Promise<Entry[]> {
    return db.getAllAsync<Entry>(`SELECT * FROM entries WHERE ${LIVE}`);
  }

  async function getByGoal(goalId: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries WHERE goal_id = ? AND ${LIVE} ORDER BY date_note DESC`,
      [goalId]
    );
  }

  async function getById(id: string): Promise<Entry | null> {
    return db.getFirstAsync<Entry>(
      `SELECT * FROM entries WHERE id = ? AND ${LIVE}`,
      [id]
    );
  }

  async function getByDateRange(from: string, to: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries WHERE date_note BETWEEN ? AND ? AND ${LIVE} ORDER BY date_note DESC`,
      [from, to]
    );
  }

  async function getByGoalAndDateRange(goalId: string, from: string, to: string): Promise<Entry[]> {
    return db.getAllAsync<Entry>(
      `SELECT * FROM entries
       WHERE goal_id = ? AND date_note BETWEEN ? AND ? AND ${LIVE}
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
      `INSERT INTO entries (id, goal_id, date_note, note, productivity_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.goalId, data.dateNote, data.note, data.productivityScore, created_at, created_at]
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

    // Mirrors the server's onupdate=now(); the UI reads it to mark an entry
    // as edited without having to ask the backend.
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    fields.push('synced = 0');
    values.push(id);

    await db.runAsync(
      `UPDATE entries SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Delete an entry as the user sees it.
   *
   * A row that never reached the server can just go. One that did becomes a
   * tombstone: hard-deleting it locally would leave the server copy alive,
   * and the next `pullEntries` would faithfully bring it back. The tombstone
   * is what carries the delete across to the backend, and `hardDelete`
   * removes it once the server confirms.
   */
  async function remove(id: string): Promise<void> {
    const row = await db.getFirstAsync<Entry>(`SELECT * FROM entries WHERE id = ?`, [id]);
    if (!row) return;
    if (row.remote_id === null) {
      await hardDelete(id);
      return;
    }
    await db.runAsync(
      `UPDATE entries SET deleted = 1, synced = 0 WHERE id = ?`,
      [id]
    );
  }

  /** Remove the row for good. Only for tombstones the server has accepted. */
  async function hardDelete(id: string): Promise<void> {
    await db.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
  }

  /** Undo a tombstone the server refused to delete — its week had closed. */
  async function restore(id: string): Promise<void> {
    await db.runAsync(`UPDATE entries SET deleted = 0, synced = 1 WHERE id = ?`, [id]);
  }

  // Called after successful sync with backend
  async function markSynced(id: string, remoteId: number): Promise<void> {
    await db.runAsync(
      `UPDATE entries SET synced = 1, remote_id = ? WHERE id = ?`,
      [remoteId, id]
    );
  }

  /** Pending pushes: new entries, edits, and tombstones alike. */
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
    if (existing) {
      // A local change not yet pushed wins: overwriting it here would discard
      // an edit (or a delete) the user made offline before it ever left.
      if (existing.synced === 0) return;
      await db.runAsync(
        `UPDATE entries SET date_note = ?, note = ?, productivity_score = ?, updated_at = ?
         WHERE remote_id = ?`,
        [remote.date_note, remote.note, remote.productivity_score, remote.updated_at, remote.id]
      );
      return;
    }
    const id = genId();
    // Prefer the server's stored write time; only fall back to "now" for
    // legacy entries that predate the created_at column (remote.created_at null).
    const created_at = remote.created_at ?? new Date().toISOString();
    await db.runAsync(
      `INSERT INTO entries (id, goal_id, date_note, note, productivity_score, created_at, updated_at, synced, remote_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, localGoalId, remote.date_note, remote.note, remote.productivity_score, created_at, remote.updated_at, remote.id]
    );
  }

  // Aggregate helpers for report generation
  async function getActiveDaysInRange(from: string, to: string): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT date_note) as count
       FROM entries WHERE date_note BETWEEN ? AND ? AND ${LIVE}`,
      [from, to]
    );
    return result?.count ?? 0;
  }

  async function getAvgScoreInRange(from: string, to: string): Promise<number | null> {
    const result = await db.getFirstAsync<{ avg: number | null }>(
      `SELECT AVG(productivity_score) as avg
       FROM entries WHERE date_note BETWEEN ? AND ? AND ${LIVE}`,
      [from, to]
    );
    return result?.avg ?? null;
  }

  async function clearAll(): Promise<void> {
    await db.runAsync(`DELETE FROM entries`);
  }

  return {
    getAll,
    getByGoal,
    getById,
    getByDateRange,
    getByGoalAndDateRange,
    create,
    update,
    remove,
    hardDelete,
    restore,
    markSynced,
    getUnsynced,
    getByRemoteId,
    upsertFromRemote,
    clearAll,
    getActiveDaysInRange,
    getAvgScoreInRange,
  };
}
