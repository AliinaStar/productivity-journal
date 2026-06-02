import { useState, useCallback } from 'react';

import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { useSync } from '@/hooks/useSync';
import { Goal } from '@/db/types';
import { formatDeadline, DeadlineTone } from '@/utils/deadline';

function todayLabel() {
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const goals = useGoals();
  const entries = useEntries();
  const { sync, pullGoals, syncing } = useSync();
  const [items, setItems] = useState<Goal[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await goals.getActive();
    setItems(data);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 6 * 86_400_000);
    const iso = (d: Date) => d.toISOString().split('T')[0];
    const weekEntries = await entries.getByDateRange(iso(weekAgo), iso(today));
    setWeekCount(weekEntries.length);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { pullGoals().then(load); }, []));

  async function handleSync() {
    await sync();
    await load();
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#534AB7', '#7F77DD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>{todayLabel()}</Text>
            <Text style={s.headerTitle}>{t('home.greetDay')}</Text>
          </View>
          <Pressable onPress={handleSync} disabled={syncing} style={s.syncBtn}>
            <Text style={s.syncText}>{syncing ? '…' : '↻'}</Text>
          </Pressable>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{loading ? '—' : items.length}</Text>
            <Text style={s.statLabel}>{t('home.activeGoals')}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{loading ? '—' : weekCount}</Text>
            <Text style={s.statLabel}>{t('home.weekEntries')}</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={s.loader} color="#7F77DD" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={<Text style={s.sectionLabel}>{t('home.sectionLabel')}</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.goalCard} onPress={() => router.push(`/goal/${item.id}`)}>
              <Text style={s.goalTitle}>{item.title}</Text>
              {item.description ? <Text style={s.goalDesc}>{item.description}</Text> : null}
              {item.deadline ? <DeadlineBadge iso={item.deadline} /> : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={s.empty}>{t('home.empty')}</Text>
          }
        />
      )}

      <Pressable style={s.fab} onPress={() => router.push('/goal')}>
        <Text style={s.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const DEADLINE_TONE: Record<DeadlineTone, { bg: string; fg: string }> = {
  overdue: { bg: '#FBE3DC', fg: '#C24A28' },
  soon:    { bg: '#FFF4E6', fg: '#E8962A' },
  normal:  { bg: '#EEEDFE', fg: '#7F77DD' },
};

function DeadlineBadge({ iso }: { iso: string }) {
  const { t } = useTranslation();
  const { text, tone } = formatDeadline(iso, t);
  const c = DEADLINE_TONE[tone];
  return (
    <View style={[s.deadlineBadge, { backgroundColor: c.bg }]}>
      <Text style={[s.deadlineText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 2, textTransform: 'capitalize' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  syncBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  syncText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 2 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  loader: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#B4B2A9', marginBottom: 8 },
  list: { padding: 16, gap: 10, paddingBottom: 80 },
  goalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  goalTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  goalDesc: { fontSize: 13, color: '#888780', marginTop: 4 },
  deadlineBadge: { marginTop: 10, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  deadlineText: { fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9', lineHeight: 22 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7F77DD', alignItems: 'center', justifyContent: 'center', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
