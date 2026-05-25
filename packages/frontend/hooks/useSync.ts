import { useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

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
    const userId = await requireUserId();

    // 1. Sync unsynced goals
    const unsyncedGoals = await goals.getUnsynced();

    for (const goal of unsyncedGoals) {
      const remote = await GoalsApi.createGoal(goal, userId);
      await goals.markSynced(goal.id, remote.id);
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

      const remote = await EntriesApi.createEntry(entry, localGoal.remote_id, userId);
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
    const userId = await requireUserId();
    const remote = await ReportsApi.fetchReport(period, periodStart, userId);

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
    const userId = await requireUserId();
    const remote = await ReportsApi.requestReport(period, periodStart, periodEnd, userId);

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

  // Full sync: push everything unsynced, update last sync timestamp
  async function sync(): Promise<void> {
    setSyncing(true);
    setError(null);

    try {
      await pushChanges();
      await syncMeta.setLastSyncAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function clearLocalData(): Promise<void> {
    await entries.clearAll();
    await goals.clearAll();
    await reports.clearAll();
  }

  async function pullGoals(): Promise<void> {
    const userId = await requireUserId();
    const remoteGoals = await GoalsApi.listGoals(userId);
    for (const remote of remoteGoals) {
      await goals.upsertFromRemote(remote);
    }
  }

  async function pullEntries(): Promise<void> {
    const userId = await requireUserId();
    const remoteEntries = await EntriesApi.listEntries(userId);
    for (const remote of remoteEntries) {
      const localGoal = await goals.getByRemoteId(remote.goal_id);
      if (!localGoal) continue;
      await entries.upsertFromRemote(remote, localGoal.id);
    }
  }

  // Pull all reports of a given period type from backend and cache any that are missing locally
  async function syncReports(period: PeriodType): Promise<void> {
    const userId = await requireUserId();
    const remoteList = await ReportsApi.listReports(period, userId);

    for (const remote of remoteList) {
      if (!remote.final_report) continue;
      const key = toPeriodKey(period, remote.period_start);
      const existing = await reports.get(period, key);
      if (existing) continue;

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
  }

  return { sync, pushChanges, pullReport, generateReport, syncReports, pullGoals, pullEntries, clearLocalData, syncing, error };
}
