import { useState, useCallback, useEffect } from 'react';

import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useSyncMeta } from '@/db/sync';
import { useSync } from '@/hooks/useSync';
import { Goal, Entry } from '@/db/types';
import { RecordEntrySheet } from '@/components/record-entry-sheet';
import { NewGoalSheet } from '@/components/new-goal-sheet';

function todayLabel() {
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function formatEntryTime(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const goals = useGoals();
  const entries = useEntries();
  const syncMeta = useSyncMeta();
  const { pushChanges, pullGoals } = useSync();
  const [items, setItems] = useState<Goal[]>([]);
  const [todayByGoal, setTodayByGoal] = useState<Map<string, Entry[]>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordGoal, setRecordGoal] = useState<Goal | null>(null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const iso = todayIso();
    const [activeGoals, todayEntries] = await Promise.all([
      goals.getActive(),
      entries.getByDateRange(iso, iso),
    ]);
    setItems(activeGoals);

    const map = new Map<string, Entry[]>();
    for (const e of todayEntries) {
      if (!map.has(e.goal_id)) map.set(e.goal_id, []);
      map.get(e.goal_id)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    setTodayByGoal(map);
    setLoading(false);
  }

  // On focus: push local changes, pull fresh goals, then refresh the list.
  // Entries aren't pulled here — today's entries are almost always the ones
  // just written locally, and notesList/goal screens keep them in sync too.
  useFocusEffect(useCallback(() => {
    (async () => {
      try { await pushChanges(); } catch {}
      try { await pullGoals(); } catch {}
      await load();
    })();
  }, []));

  // Show the product tour once, on the first time this screen mounts (i.e. the
  // first entry into the tabs after onboarding). Retaking it from Profile
  // navigates here directly, so this only needs to fire once per cold start.
  useEffect(() => {
    syncMeta.getTourCompleted().then(done => {
      if (!done) router.push('/tour');
    });
  }, []);

  function onCardTap(goal: Goal, empty: boolean) {
    if (empty) setRecordGoal(goal);
    else setExpandedId(id => (id === goal.id ? null : goal.id));
  }

  // After saving, refresh the list and expand the goal so the new entry is visible.
  async function handleEntrySaved(goalId: string) {
    setRecordGoal(null);
    await load();
    setExpandedId(goalId);
  }

  async function handleGoalSaved() {
    setShowNewGoal(false);
    await load();
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <Text style={s.dateLabel}>{todayLabel()}</Text>
        <Text style={s.title}>{t('today.title')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} color="#7F77DD" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={items.length > 0 ? <Text style={s.sectionLabel}>{t('today.tapToRecord')}</Text> : null}
          renderItem={({ item }) => {
            const todayEntries = todayByGoal.get(item.id) ?? [];
            const empty = todayEntries.length === 0;
            const expanded = expandedId === item.id;
            return (
              <GoalCard
                goal={item}
                todayEntries={todayEntries}
                empty={empty}
                expanded={expanded}
                onTap={() => onCardTap(item, empty)}
                onAddEntry={() => setRecordGoal(item)}
              />
            );
          }}
          ListFooterComponent={
            <Pressable style={s.newGoalBtn} onPress={() => setShowNewGoal(true)}>
              <Text style={s.newGoalBtnText}>＋ {t('today.newGoal')}</Text>
            </Pressable>
          }
          ListEmptyComponent={<Text style={s.empty}>{t('today.empty')}</Text>}
        />
      )}

      <View style={s.bottomBar}>
        <Pressable style={s.mgmtBtn} onPress={() => router.push('/goals')}>
          <Text style={s.mgmtBtnText}>{t('today.manageGoals')}</Text>
        </Pressable>
      </View>

      <RecordEntrySheet goal={recordGoal} onClose={() => setRecordGoal(null)} onSaved={handleEntrySaved} />
      <NewGoalSheet visible={showNewGoal} onClose={() => setShowNewGoal(false)} onSaved={handleGoalSaved} />
    </View>
  );
}

function GoalCard({
  goal,
  todayEntries,
  empty,
  expanded,
  onTap,
  onAddEntry,
}: {
  goal: Goal;
  todayEntries: Entry[];
  empty: boolean;
  expanded: boolean;
  onTap: () => void;
  onAddEntry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.goalCard}>
      <Pressable style={s.goalRow} onPress={onTap}>
        <View style={s.goalTextCol}>
          <Text style={s.goalTitle} numberOfLines={1}>{goal.title}</Text>
          <Text style={[s.goalSub, empty ? s.goalSubEmpty : s.goalSubFilled]}>
            {empty ? t('today.noEntryToday') : t('today.entriesToday', { count: todayEntries.length })}
          </Text>
        </View>
        {empty ? (
          <View style={s.addCircle}>
            <Text style={s.addCircleText}>＋</Text>
          </View>
        ) : (
          <Text style={[s.chevron, expanded && s.chevronOpen]}>›</Text>
        )}
      </Pressable>

      {!empty && expanded && (
        <View style={s.expandedArea}>
          {todayEntries.map(e => (
            <View key={e.id} style={s.entryRow}>
              <Text style={s.entryTime}>{formatEntryTime(e.created_at)}</Text>
              <View style={s.entryTextCol}>
                <Text style={s.entryStars}>{'★'.repeat(e.productivity_score)}</Text>
                <Text style={s.entryText}>{e.note}</Text>
              </View>
            </View>
          ))}
          <Pressable style={s.addMoreBtn} onPress={onAddEntry}>
            <Text style={s.addMoreBtnText}>＋ {t('today.addEntry')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  header: { paddingTop: 16, paddingHorizontal: 22 },
  dateLabel: { fontSize: 12, fontWeight: '600', color: '#A8A69E' },
  title: { fontSize: 26, fontWeight: '800', color: '#26215C', letterSpacing: -0.4, marginTop: 2 },
  loader: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#B4B2A9', marginBottom: 11 },
  list: { padding: 22, paddingTop: 18, paddingBottom: 24, gap: 11 },

  goalCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 18 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  goalTextCol: { flex: 1 },
  goalTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2A' },
  goalSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  goalSubEmpty: { color: '#B4B2A9', fontWeight: '500' },
  goalSubFilled: { color: '#4CAF88' },
  addCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#7F77DD', alignItems: 'center', justifyContent: 'center', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4 },
  addCircleText: { color: '#fff', fontSize: 17, lineHeight: 19 },
  chevron: { fontSize: 20, fontWeight: '600', color: '#B4B2A9', paddingHorizontal: 2 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  expandedArea: { borderTopWidth: 1, borderTopColor: '#F2F0EA', marginHorizontal: 15, paddingTop: 11, paddingBottom: 15, gap: 9 },
  entryRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  entryTime: { fontSize: 10, fontWeight: '600', color: '#928F87', width: 34 },
  entryTextCol: { flex: 1 },
  entryStars: { fontSize: 9, fontWeight: '700', color: '#F5B73C' },
  entryText: { fontSize: 11, color: '#2C2C2A', marginTop: 1, lineHeight: 15 },
  addMoreBtn: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', borderRadius: 12, paddingVertical: 9 },
  addMoreBtnText: { fontSize: 12, fontWeight: '700', color: '#7F77DD' },

  newGoalBtn: { borderWidth: 1.5, borderColor: '#D9D6CE', borderStyle: 'dashed', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  newGoalBtnText: { fontSize: 12.5, fontWeight: '600', color: '#9B99A9' },

  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9', lineHeight: 22 },

  bottomBar: { paddingHorizontal: 22, paddingBottom: 12 },
  mgmtBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F1EFEA', borderWidth: 1, borderColor: '#E7E4DD', borderRadius: 14, paddingVertical: 13 },
  mgmtBtnText: { fontSize: 13, fontWeight: '600', color: '#7A776E' },
});
