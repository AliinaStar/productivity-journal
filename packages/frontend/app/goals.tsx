import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useSync } from '@/hooks/useSync';
import { Goal, GoalStatus } from '@/db/types';
import { formatDeadline } from '@/utils/deadline';

const TABS: GoalStatus[] = ['active', 'finished', 'postpone'];

const BADGE: Record<GoalStatus, { bg: string; fg: string }> = {
  active:   { bg: 'rgba(127,119,221,.14)', fg: '#7F77DD' },
  finished: { bg: 'rgba(76,175,136,.16)',  fg: '#3E9E76' },
  postpone: { bg: '#ECEAE4',               fg: '#8C8A82' },
};

function buildMeta(goal: Goal, entryCount: number, t: TFunction): string {
  const parts: string[] = [];
  if (goal.deadline) parts.push(formatDeadline(goal.deadline, t).text);
  parts.push(t('notes.entries', { count: entryCount }));
  return parts.join(' · ');
}

export default function GoalsScreen() {
  const { t } = useTranslation();
  const goals = useGoals();
  const entries = useEntries();
  const { pushChanges, pullGoals, pullEntries } = useSync();
  const [tab, setTab] = useState<GoalStatus>('active');
  const [items, setItems] = useState<Goal[]>([]);
  const [countByGoal, setCountByGoal] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    const [all, allEntries] = await Promise.all([goals.getAll(), entries.getAll()]);
    setItems(all);
    const map = new Map<string, number>();
    for (const e of allEntries) map.set(e.goal_id, (map.get(e.goal_id) ?? 0) + 1);
    setCountByGoal(map);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => {
    (async () => {
      try { await pushChanges(); } catch {}
      try { await pullGoals(); } catch {}
      try { await pullEntries(); } catch {}
      await load();
    })();
  }, []));

  const filtered = items.filter(g => g.status === tab);

  return (
    <View style={s.container}>
      <View style={s.tabRow}>
        {TABS.map(key => (
          <Pressable key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{t(`goals.tabs.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} color="#7F77DD" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => router.push(`/goal/${item.id}`)}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={[s.badge, { backgroundColor: BADGE[item.status].bg }]}>
                  <Text style={[s.badgeText, { color: BADGE[item.status].fg }]}>
                    {t(`goal.statuses.${item.status}`)}
                  </Text>
                </View>
              </View>
              <Text style={s.cardMeta}>{buildMeta(item, countByGoal.get(item.id) ?? 0, t)}</Text>
              <Text style={s.cardLink}>{t('goals.openHistory')}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={s.empty}>{t('goals.empty')}</Text>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  tabRow: { flexDirection: 'row', backgroundColor: '#EEECE6', borderRadius: 13, padding: 3, margin: 20, marginBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: '600', color: '#8C8A82' },
  tabTextActive: { color: '#26215C', fontWeight: '700' },
  loader: { flex: 1 },
  list: { padding: 20, paddingTop: 16, gap: 10, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 16, padding: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#2C2C2A', marginRight: 8 },
  badge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: '#928F87', marginTop: 6 },
  cardLink: { fontSize: 11.5, fontWeight: '600', color: '#7F77DD', marginTop: 9 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9' },
});
