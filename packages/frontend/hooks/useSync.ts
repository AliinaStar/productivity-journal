import { useState } from 'react';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useReports } from '@/db/reports';
import { useSyncMeta } from '@/db/sync';

import * as GoalsApi from '@/api-client/goals';
import * as EntriesApi from '@/api-client/entries';
import * as ReportsApi from '@/api-client/reports';
import * as UsersApi from '@/api-client/users';
import { ApiError } from '@/api-client/client';
import { Entry, PeriodType } from '@/db/types';
import { toPeriodKey } from '@/utils/period';
import { createSerialiser } from '@/utils/serialise';

// Matches the backend's max page limit so offline sync stays complete.
const PAGE_SIZE = 100;

/**
 * Serialises every push, across all callers — see `createSerialiser`.
 *
 * Module scope on purpose: one queue shared by every `useSync()` instance in
 * the app. The server also rejects duplicates on its own now, via client_id;
 * this stops the second request being made at all, and keeps `markSynced`
 * from racing another push that has already read the same rows.
 */
const serialised = createSerialiser();

/** Fetch every page from a paginated endpoint until a short page is returned. */
async function fetchAllPages<T>(fetchPage: (offset: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goals   = useGoals();
  const entries = useEntries();
  const reports = useReports();
  const syncMeta = useSyncMeta();

  async function requireUserId(): Promise<number> {
    const userId = await syncMeta.getUserRemoteId();
    if (!userId) throw new Error('User not authenticated.');
    return userId;
  }

  /**
   * Report the device's timezone, but only when it actually changed.
   *
   * The server resolves week boundaries in this zone, so a stale value means
   * entries lock at the wrong moment and reports arrive at the wrong hour.
   * Best-effort: a failure here must never abort a sync that is carrying the
   * user's actual writing.
   */
  async function pushTimezone(): Promise<void> {
    const tz = UsersApi.deviceTimezone();
    if (!tz) return;
    if ((await syncMeta.getReportedTimezone()) === tz) return;
    try {
      await UsersApi.updateTimezone(tz);
      await syncMeta.setReportedTimezone(tz);
    } catch {
      // Retried on the next sync.
    }
  }

  /**
   * Push one entry: a tombstone, an edit, or a brand-new row.
   *
   * A 403 means the entry's week closed before the change reached the server
   * — offline on Sunday night, syncing on Monday. The change can never be
   * accepted, so retrying it forever would wedge the queue behind a row that
   * will always fail. The server's copy wins: the local change is abandoned
   * and `pullEntries` restores what the backend actually holds.
   */
  async function pushEntry(entry: Entry): Promise<void> {
    if (entry.deleted) {
      if (!entry.remote_id) {
        await entries.hardDelete(entry.id);
        return;
      }
      try {
        await EntriesApi.deleteEntry(entry.remote_id);
        await entries.hardDelete(entry.id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          // Too late to delete — bring the row back rather than hiding an
          // entry locally that still exists (and is quoted in a report).
          await entries.restore(entry.id);
          return;
        }
        throw e;
      }
      return;
    }

    // Find the local goal to get its remote_id
    const localGoal = await goals.getById(entry.goal_id);

    if (!localGoal?.remote_id) {
      // Goal wasn't synced yet — skip this entry for now
      return;
    }

    if (entry.remote_id) {
      // An edit to a row the server already has. Without this branch the
      // entry would be POSTed a second time and duplicated on the backend.
      try {
        await EntriesApi.updateEntry(entry.remote_id, {
          note: entry.note,
          productivity_score: entry.productivity_score,
          date_note: entry.date_note,
        });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 403) throw e;
      }
      // Marked synced either way: on 403 the pull that follows overwrites the
      // local row with the server's version, which is now the truth.
      await entries.markSynced(entry.id, entry.remote_id);
      return;
    }

    const remote = await EntriesApi.createEntry(entry, localGoal.remote_id);
    await entries.markSynced(entry.id, remote.id);
  }

  // Push local unsynced data → backend
  // Goals must go before entries (entries reference goal remote_id)
  //
  // Serialised: see `serialised` above. Two overlapping pushes would each read
  // the same unsynced rows and send them.
  function pushChanges(): Promise<void> {
    return serialised(async () => {
      await requireUserId();
      await pushTimezone();

      // 1. Sync unsynced goals
      const unsyncedGoals = await goals.getUnsynced();

      for (const goal of unsyncedGoals) {
        if (goal.remote_id) {
          await GoalsApi.updateGoal(goal.remote_id, { title: goal.title, description: goal.description, deadline: goal.deadline, status: goal.status });
          await goals.markSynced(goal.id, goal.remote_id);
        } else {
          const remote = await GoalsApi.createGoal(goal);
          await goals.markSynced(goal.id, remote.id);
        }
      }

      // 2. Sync unsynced entries — creates, edits and deletes
      const unsyncedEntries = await entries.getUnsynced();

      for (const entry of unsyncedEntries) {
        await pushEntry(entry);
      }
    });
  }

  // Pull a specific report from backend and cache it locally
  async function pullReport(
    period: PeriodType,
    periodKey: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<void> {
    await requireUserId();
    const remote = await ReportsApi.fetchReport(period, periodStart);

    if (!remote?.final_report) return;

    await reports.upsert({
      period_type:      period,
      period_key:       periodKey,
      period_start:     periodStart,
      period_end:       periodEnd,
      avg_productivity: remote.avg_productivity,
      active_days:      remote.active_days,
      data:             JSON.stringify(remote.final_report),
    });
  }

  // Full sync: push local changes, then pull remote state
  async function sync(): Promise<void> {
    setSyncing(true);
    setError(null);

    try {
      await pushChanges();
      await pullGoals();
      await pullEntries();
      await syncMeta.setLastSyncAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Silent background sync — doesn't block the manual sync button
  async function syncIfStale(thresholdMs = 5 * 60 * 1000): Promise<void> {
    const lastSync = await syncMeta.getLastSyncAt();
    if (lastSync && Date.now() - new Date(lastSync).getTime() < thresholdMs) return;

    setBackgroundSyncing(true);
    try {
      await pushChanges();
      await pullGoals();
      await pullEntries();
      await syncMeta.setLastSyncAt(new Date().toISOString());
    } catch {
      // background sync failures are silent
    } finally {
      setBackgroundSyncing(false);
    }
  }

  async function clearLocalData(): Promise<void> {
    await entries.clearAll();
    await goals.clearAll();
    await reports.clearAll();
  }

  async function pullGoals(): Promise<void> {
    await requireUserId();
    const remoteGoals = await fetchAllPages(offset => GoalsApi.listGoals(PAGE_SIZE, offset));

    const remoteIds = new Set(remoteGoals.map(g => g.id));
    for (const remote of remoteGoals) {
      await goals.upsertFromRemote(remote);
    }

    // Remove local goals that no longer exist on the backend
    const localGoals = await goals.getAll();
    for (const local of localGoals) {
      if (local.remote_id && !remoteIds.has(local.remote_id)) {
        await goals.remove(local.id);
      }
    }
  }

  async function pullEntries(): Promise<void> {
    await requireUserId();
    const remoteEntries = await fetchAllPages(offset => EntriesApi.listEntries(PAGE_SIZE, offset));

    const remoteIds = new Set(remoteEntries.map(e => e.id));
    for (const remote of remoteEntries) {
      const localGoal = await goals.getByRemoteId(remote.goal_id);
      if (!localGoal) continue;
      await entries.upsertFromRemote(remote, localGoal.id);
    }

    // Remove local entries that no longer exist on the backend. hardDelete,
    // not remove: the row is already gone server-side, so leaving a tombstone
    // would queue a DELETE for something there is nothing left to delete.
    const localEntries = await entries.getAll();
    for (const local of localEntries) {
      if (local.remote_id && !remoteIds.has(local.remote_id)) {
        await entries.hardDelete(local.id);
      }
    }
  }

  // Pull all reports of a given period type from backend — upsert new ones, remove deleted ones
  async function syncReports(period: PeriodType): Promise<void> {
    await requireUserId();
    const remoteList = await fetchAllPages(offset => ReportsApi.listReports(period, PAGE_SIZE, offset));

    const remoteKeys = new Set<string>();

    for (const remote of remoteList) {
      if (!remote.final_report) continue;
      const key = toPeriodKey(period, remote.period_start);
      remoteKeys.add(key);

      await reports.upsert({
        period_type:      period,
        period_key:       key,
        period_start:     remote.period_start,
        period_end:       remote.period_end,
        avg_productivity: remote.avg_productivity,
        active_days:      remote.active_days,
        data:             JSON.stringify(remote.final_report),
      });
    }

    // Remove local reports that no longer exist on the backend
    const localList = await reports.getAll(period);
    for (const local of localList) {
      if (!remoteKeys.has(local.period_key)) {
        await reports.remove(period, local.period_key);
      }
    }
  }

  return { sync, syncIfStale, pushChanges, pullReport, syncReports, pullGoals, pullEntries, clearLocalData, syncing, backgroundSyncing, error };
}
