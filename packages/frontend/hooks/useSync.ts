import { useState } from 'react';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useReports } from '@/db/reports';
import { useSyncMeta } from '@/db/sync';

import * as GoalsApi from '@/api-client/goals';
import * as EntriesApi from '@/api-client/entries';
import * as ReportsApi from '@/api-client/reports';
import { PeriodType } from '@/db/types';
import { toPeriodKey } from '@/utils/period';

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

  // Push local unsynced data → backend
  // Goals must go before entries (entries reference goal remote_id)
  async function pushChanges(): Promise<void> {
    await requireUserId();

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

    // 2. Sync unsynced entries
    const unsyncedEntries = await entries.getUnsynced();

    for (const entry of unsyncedEntries) {
      // Find the local goal to get its remote_id
      const localGoal = await goals.getById(entry.goal_id);

      if (!localGoal?.remote_id) {
        // Goal wasn't synced yet — skip this entry for now
        continue;
      }

      const remote = await EntriesApi.createEntry(entry, localGoal.remote_id);
      await entries.markSynced(entry.id, remote.id);
    }
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

  // Request backend to generate a new report, then cache it
  async function generateReport(
    period: PeriodType,
    periodKey: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<void> {
    await pushChanges();
    await requireUserId();
    const remote = await ReportsApi.requestReport(period, periodStart, periodEnd);

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
    const remoteGoals = await GoalsApi.listGoals();

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
    const remoteEntries = await EntriesApi.listEntries();

    const remoteIds = new Set(remoteEntries.map(e => e.id));
    for (const remote of remoteEntries) {
      const localGoal = await goals.getByRemoteId(remote.goal_id);
      if (!localGoal) continue;
      await entries.upsertFromRemote(remote, localGoal.id);
    }

    // Remove local entries that no longer exist on the backend
    const localEntries = await entries.getAll();
    for (const local of localEntries) {
      if (local.remote_id && !remoteIds.has(local.remote_id)) {
        await entries.remove(local.id);
      }
    }
  }

  // Pull all reports of a given period type from backend — upsert new ones, remove deleted ones
  async function syncReports(period: PeriodType): Promise<void> {
    await requireUserId();
    const remoteList = await ReportsApi.listReports(period);

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

  return { sync, syncIfStale, pushChanges, pullReport, generateReport, syncReports, pullGoals, pullEntries, clearLocalData, syncing, backgroundSyncing, error };
}
