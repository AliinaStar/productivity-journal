import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSyncMeta } from '@/db/sync';
import { useGoals } from '@/db/goals';
import { useSync } from '@/hooks/useSync';
import { Goal } from '@/db/types';

const STATUS_LABEL: Record<string, string> = {
  active:   'Активна',
  finished: 'Завершена',
  postpone: 'Відкладена',
};

const STATUS_COLOR: Record<string, string> = {
  active:   '#7F77DD',
  finished: '#4CAF88',
  postpone: '#B4B2A9',
};

export default function ProfileScreen() {
  const syncMeta = useSyncMeta();
  const goalsDb = useGoals();
  const { clearLocalData } = useSync();
  const [userId, setUserId] = useState<number | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);

  useFocusEffect(useCallback(() => {
    syncMeta.getUserRemoteId().then(setUserId);
    goalsDb.getAll().then(setGoals);
  }, []));

  async function handleLogout() {
    await clearLocalData();
    await syncMeta.set('user_remote_id', '');
    router.replace('/login');
  }

  const active    = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'finished');
  const archived  = goals.filter(g => g.status === 'postpone');

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity style={s.gearBtn} onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <Text style={s.gearIcon}>⚙️</Text>
        </TouchableOpacity>
        <View style={s.avatar}>
          <Text style={s.avatarText}>👤</Text>
        </View>
        <Text style={s.name}>User {userId ?? '—'}</Text>
        <Text style={s.meta}>ID: {userId ?? '—'}</Text>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutText}>Вийти</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Мої цілі</Text>

      {goals.length === 0 ? (
        <Text style={s.empty}>Цілей ще немає</Text>
      ) : (
        <>
          {active.length > 0 && <GoalGroup label="Активні" goals={active} />}
          {completed.length > 0 && <GoalGroup label="Завершені" goals={completed} />}
          {archived.length > 0 && <GoalGroup label="Архів" goals={archived} />}
        </>
      )}
    </ScrollView>
  );
}

function GoalGroup({ label, goals }: { label: string; goals: Goal[] }) {
  return (
    <View style={s.group}>
      <Text style={s.groupLabel}>{label}</Text>
      {goals.map(goal => (
        <View key={goal.id} style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{goal.title}</Text>
            <View style={s.cardActions}>
              <View style={[s.badge, { backgroundColor: STATUS_COLOR[goal.status] + '22' }]}>
                <Text style={[s.badgeText, { color: STATUS_COLOR[goal.status] }]}>
                  {STATUS_LABEL[goal.status]}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/goal/edit/${goal.id}`)}
                style={s.editBtn}
                activeOpacity={0.7}
              >
                <Text style={s.editIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          </View>
          {goal.description ? (
            <Text style={s.cardDesc} numberOfLines={2}>{goal.description}</Text>
          ) : null}
          {goal.deadline ? (
            <Text style={s.cardMeta}>до {goal.deadline}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 20, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 32 },
  gearBtn: { position: 'absolute', top: 0, right: 0, padding: 8 },
  gearIcon: { fontSize: 22 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEEDFE', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 36 },
  name: { fontSize: 18, fontWeight: '600', color: '#26215C', marginBottom: 2 },
  meta: { fontSize: 13, color: '#888780', marginBottom: 16 },
  logoutBtn: { backgroundColor: '#FAECE7', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  logoutText: { color: '#993C1D', fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  empty: { textAlign: 'center', color: '#B4B2A9', fontSize: 14, marginTop: 20 },

  group: { marginBottom: 20 },
  groupLabel: { fontSize: 12, fontWeight: '600', color: '#B4B2A9', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtn: { padding: 2 },
  editIcon: { fontSize: 15 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#2C2C2A', flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardDesc: { fontSize: 13, color: '#5F5E5A', lineHeight: 18, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#B4B2A9' },
});
