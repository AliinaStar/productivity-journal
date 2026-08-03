import { useState, useCallback, useEffect } from 'react';

import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useSyncMeta } from '@/db/sync';
import { useSync } from '@/hooks/useSync';
import { useResponsive } from '@/hooks/useResponsive';
import { Goal, Entry } from '@/db/types';
import { todayIso } from '@/utils/date';
import { isEntryEditable } from '@/utils/entryWindow';
import { Bounded } from '@/components/bounded';
import { NavIcon } from '@/components/nav-icon';
import { GoalDetailView } from '@/components/goal-detail-view';
import { RecordEntrySheet } from '@/components/record-entry-sheet';
import { NewGoalSheet } from '@/components/new-goal-sheet';

function todayLabel() {
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatEntryTime(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { twoColumn } = useResponsive();
  const goals = useGoals();
  const entries = useEntries();
  const syncMeta = useSyncMeta();
  const { pushChanges, pullGoals } = useSync();
  const [items, setItems] = useState<Goal[]>([]);
  const [todayByGoal, setTodayByGoal] = useState<Map<string, Entry[]>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailHistory, setDetailHistory] = useState<Entry[]>([]);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
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

  // Master-detail (tablet landscape): keep a valid selection and load the
  // selected goal's full history for the detail panel.
  useEffect(() => {
    if (!twoColumn || loading) return;
    if (items.length === 0) { setSelectedId(null); return; }
    if (!items.some(g => g.id === selectedId)) setSelectedId(items[0].id);
  }, [twoColumn, loading, items, selectedId]);

  useEffect(() => {
    if (!twoColumn || !selectedId) { setDetailHistory([]); return; }
    let live = true;
    entries.getByGoal(selectedId).then(h => { if (live) setDetailHistory(h); });
    return () => { live = false; };
  }, [twoColumn, selectedId]);

  function onCardTap(goal: Goal, empty: boolean) {
    if (empty) { setEditingEntry(null); setRecordGoal(goal); }
    else setExpandedId(id => (id === goal.id ? null : goal.id));
  }

  // After saving, refresh the list and reveal the new entry — expand it on the
  // phone list, and refresh the detail panel on tablet.
  async function handleEntrySaved(goalId: string) {
    setRecordGoal(null);
    setEditingEntry(null);
    await load();
    setExpandedId(goalId);
    if (twoColumn) {
      setSelectedId(goalId);
      setDetailHistory(await entries.getByGoal(goalId));
    }
  }

  function handleEditEntry(goal: Goal, entry: Entry) {
    setEditingEntry(entry);
    setRecordGoal(goal);
  }

  function handleDeleteEntry(goal: Goal, entry: Entry) {
    Alert.alert(
      t('entry.deleteTitle'),
      t('entry.deleteMessage'),
      [
        { text: t('entry.cancel'), style: 'cancel' },
        {
          text: t('entry.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            // Local-first: tombstoned now, DELETE pushed on the next sync, so
            // this works offline like every other write in the app.
            await entries.remove(entry.id);
            await load();
            if (twoColumn) setDetailHistory(await entries.getByGoal(goal.id));
          },
        },
      ],
    );
  }

  async function handleGoalSaved() {
    setShowNewGoal(false);
    await load();
  }

  const sheets = (
    <>
      <RecordEntrySheet
        goal={recordGoal}
        entry={editingEntry}
        onClose={() => { setRecordGoal(null); setEditingEntry(null); }}
        onSaved={handleEntrySaved}
      />
      <NewGoalSheet visible={showNewGoal} onClose={() => setShowNewGoal(false)} onSaved={handleGoalSaved} />
    </>
  );

  // ----- Tablet landscape: master (goal list) + detail panel -----
  if (twoColumn) {
    const selectedGoal = items.find(g => g.id === selectedId) ?? null;
    return (
      <View style={s.container}>
        <View style={s.split}>
          <View style={s.master}>
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
                contentContainerStyle={s.masterList}
                renderItem={({ item }) => (
                  <MasterRow
                    goal={item}
                    count={(todayByGoal.get(item.id) ?? []).length}
                    selected={item.id === selectedId}
                    onPress={() => setSelectedId(item.id)}
                  />
                )}
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
          </View>

          <View style={s.detail}>
            {selectedGoal ? (
              <ScrollView contentContainerStyle={s.detailContent}>
                <GoalDetailView
                  goal={selectedGoal}
                  history={detailHistory}
                  onEditEntry={entry => handleEditEntry(selectedGoal, entry)}
                  onDeleteEntry={entry => handleDeleteEntry(selectedGoal, entry)}
                  action={
                    <Pressable
                      style={s.addEntryBtn}
                      onPress={() => { setEditingEntry(null); setRecordGoal(selectedGoal); }}
                    >
                      <Text style={s.addEntryBtnText}>＋ {t('entry.new')}</Text>
                    </Pressable>
                  }
                />
              </ScrollView>
            ) : (
              <View style={s.detailEmpty}>
                <Text style={s.detailEmptyTitle}>{t('today.selectGoal')}</Text>
                <Text style={s.detailEmptySub}>{t('today.selectGoalSub')}</Text>
              </View>
            )}
          </View>
        </View>
        {sheets}
      </View>
    );
  }

  // ----- Phone (and tablet portrait): single-column list -----
  return (
    <View style={s.container}>
      <Bounded>
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
                  onAddEntry={() => { setEditingEntry(null); setRecordGoal(item); }}
                  onEditEntry={entry => handleEditEntry(item, entry)}
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
      </Bounded>
      {sheets}
    </View>
  );
}

// Selectable goal row for the tablet master column.
function MasterRow({
  goal,
  count,
  selected,
  onPress,
}: {
  goal: Goal;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable style={[s.masterCard, selected && s.masterCardSelected]} onPress={onPress}>
      <View style={s.goalTextCol}>
        <Text style={s.goalTitle} numberOfLines={1}>{goal.title}</Text>
        <Text style={[s.goalSub, count > 0 ? s.goalSubFilled : s.goalSubEmpty]}>
          {count > 0 ? t('today.entriesToday', { count }) : t('today.noEntryToday')}
        </Text>
      </View>
      <Text style={[s.chevron, selected && s.chevronSelected]}>›</Text>
    </Pressable>
  );
}

function GoalCard({
  goal,
  todayEntries,
  empty,
  expanded,
  onTap,
  onAddEntry,
  onEditEntry,
}: {
  goal: Goal;
  todayEntries: Entry[];
  empty: boolean;
  expanded: boolean;
  onTap: () => void;
  onAddEntry: () => void;
  onEditEntry: (entry: Entry) => void;
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
              {/* Today's entries are always inside their own week, but the
                  check is what ties the button to the rule rather than to an
                  assumption about which entries this list happens to show. */}
              {isEntryEditable(e) && (
                <Pressable
                  onPress={() => onEditEntry(e)}
                  hitSlop={10}
                  accessibilityLabel={t('entry.edit')}
                  style={s.entryEditBtn}
                >
                  <NavIcon shape="pencil" color="#B4B2A9" />
                </Pressable>
              )}
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

  // Master-detail (tablet)
  split: { flex: 1, flexDirection: 'row' },
  master: { width: 380, borderRightWidth: 1, borderRightColor: '#EDEAE3' },
  masterList: { padding: 22, paddingTop: 16, gap: 10 },
  masterCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#EEECE6', borderRadius: 18, padding: 15 },
  masterCardSelected: { backgroundColor: '#F3F1FD', borderColor: '#C9C3F0' },
  chevronSelected: { color: '#7F77DD' },
  detail: { flex: 1 },
  detailContent: { padding: 32, paddingTop: 26, paddingBottom: 40 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  detailEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#928F87' },
  detailEmptySub: { fontSize: 13, color: '#B4B2A9', marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  addEntryBtn: { backgroundColor: '#7F77DD', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
  addEntryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

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
  // Nudged up so the pencil sits level with the stars, not the note body.
  entryEditBtn: { paddingLeft: 4, marginTop: -1 },
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
