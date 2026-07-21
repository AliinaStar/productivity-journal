import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { Goal, Entry } from '@/db/types';
import { computeStreak } from '@/utils/streak';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function formatWhen(dateNote: string, t: TFunction, locale: string): string {
  if (dateNote === todayIso()) return t('deadline.today');
  if (dateNote === isoDaysAgo(1)) return t('goalDetail.yesterday');
  return new Date(dateNote).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

export default function GoalDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalsDb = useGoals();
  const entriesDb = useEntries();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [g, list] = await Promise.all([goalsDb.getById(id), entriesDb.getByGoal(id)]);
      setGoal(g);
      setHistory(list);
      setLoading(false);
    })();
  }, [id]));

  if (loading || !goal) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#7F77DD" />
      </View>
    );
  }

  const count = history.length;
  const avg = count > 0
    ? (history.reduce((sum, e) => sum + e.productivity_score, 0) / count).toFixed(1)
    : '—';
  const streak = computeStreak(history.map(e => e.date_note));
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.topRow}>
        <Text style={s.title} numberOfLines={2}>{goal.title}</Text>
        <Pressable style={s.editBtn} onPress={() => router.push(`/goal/edit/${goal.id}`)} hitSlop={8}>
          <Text style={s.editBtnText}>{t('goalDetail.edit')}</Text>
        </Pressable>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{count}</Text>
          <Text style={s.statLabel}>{t('goalDetail.entriesLabel')}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{avg}</Text>
          <Text style={s.statLabel}>{t('goalDetail.avgLabel')}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{streak}</Text>
          <Text style={s.statLabel}>{t('goalDetail.streakLabel')}</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>{t('goalDetail.historyLabel')}</Text>

      {history.length === 0 ? (
        <Text style={s.empty}>{t('goalDetail.emptyHistory')}</Text>
      ) : (
        <View style={s.timeline}>
          {history.map((e, i) => (
            <View key={e.id} style={s.timelineRow}>
              <View style={s.timelineDotCol}>
                <View style={[s.dot, i === 0 && s.dotFirst]} />
                {i < history.length - 1 && <View style={s.timelineLine} />}
              </View>
              <View style={s.timelineBody}>
                <Text style={s.timelineWhen}>{formatWhen(e.date_note, t, locale)}</Text>
                <View style={s.timelineCard}>
                  <Text style={s.timelineStars}>{'★'.repeat(e.productivity_score)}</Text>
                  <Text style={s.timelineText}>{e.note}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 20, paddingTop: 22, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontSize: 23, fontWeight: '800', color: '#26215C', letterSpacing: -0.3 },
  editBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  editBtnText: { fontSize: 13.5, fontWeight: '700', color: '#7F77DD' },

  statsRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  stat: {},
  statValue: { fontSize: 20, fontWeight: '800', color: '#7F77DD' },
  statLabel: { fontSize: 10.5, fontWeight: '500', color: '#928F87', marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#B4B2A9', marginTop: 22, marginBottom: 14 },

  timeline: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineDotCol: { alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#C9C3F0' },
  dotFirst: { backgroundColor: '#7F77DD' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E7E4DD', marginTop: 2 },
  timelineBody: { flex: 1, paddingBottom: 15 },
  timelineWhen: { fontSize: 12, fontWeight: '700', color: '#2C2C2A' },
  timelineCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginTop: 6, shadowColor: '#26215C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  timelineStars: { fontSize: 10.5, fontWeight: '700', color: '#F5B73C' },
  timelineText: { fontSize: 12, color: '#2C2C2A', marginTop: 4, lineHeight: 17 },

  empty: { textAlign: 'center', marginTop: 30, fontSize: 14, color: '#B4B2A9' },
});
