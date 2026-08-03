import * as SQLite from 'expo-sqlite';

/**
 * Add a column to an existing table, if it isn't there already.
 *
 * `CREATE TABLE IF NOT EXISTS` below only shapes *new* installs — a device
 * that already has the database keeps whatever columns it was created with.
 * So every column added after the first release needs a matching ALTER here,
 * guarded by a table_info check because SQLite has no `ADD COLUMN IF NOT
 * EXISTS`.
 */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some(c => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function migrateDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS goals (
      id          TEXT PRIMARY KEY,
      remote_id   INTEGER,
      title       TEXT NOT NULL,
      description TEXT,
      deadline    TEXT,
      created_at  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active', 'postpone', 'finished')),
      synced      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id                  TEXT PRIMARY KEY,
      remote_id           INTEGER,
      goal_id             TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      date_note           TEXT NOT NULL,
      note                TEXT NOT NULL,
      productivity_score  INTEGER NOT NULL
                          CHECK(productivity_score BETWEEN 1 AND 5),
      created_at          TEXT NOT NULL,
      updated_at          TEXT,
      -- Tombstone. A row deleted while offline has to outlive the delete so
      -- the next sync can tell the server about it; hard-deleting locally
      -- would leave the server copy alive and pullEntries would bring it
      -- straight back. Cleared for good once the server confirms.
      deleted             INTEGER NOT NULL DEFAULT 0,
      synced              INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports_cache (
      id               TEXT PRIMARY KEY,
      period_type      TEXT NOT NULL CHECK(period_type IN ('week', 'month', 'year')),
      period_key       TEXT NOT NULL,
      period_start     TEXT NOT NULL,
      period_end       TEXT NOT NULL,
      avg_productivity REAL,
      active_days      INTEGER NOT NULL DEFAULT 0,
      data             TEXT NOT NULL,
      cached_at        TEXT NOT NULL,
      UNIQUE(period_type, period_key)
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Existing installs: added alongside entry editing. updated_at stays NULL
  // for rows written before it existed — "never edited", same as the server's
  // reading of NULL.
  await addColumnIfMissing(db, 'entries', 'updated_at', 'TEXT');
  await addColumnIfMissing(db, 'entries', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
}
