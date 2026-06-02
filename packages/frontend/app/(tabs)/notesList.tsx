import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEntries } from '@/db/entries';
import { useSync } from '@/hooks/useSync';
import { Entry } from '@/db/types';
import i18n from '@/i18n';

function formatDate(iso: string) {
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function stripeColor(score: number): string {
  if (score >= 4.0) return '#534AB7';
  if (score >= 3.0) return '#7F77DD';
  if (score >= 2.0) return '#9B8FD9';
  return '#C5BFEE';
}

function scoreColor(score: number): string {
  if (score >= 4.0) return '#534AB7';
  if (score >= 3.0) return '#7F77DD';
  if (score >= 2.0) return '#9B8FD9';
  return '#B4AEED';
}

export default function NotesList() {
  const { t } = useTranslation();
  const entries = useEntries();
  const { pullGoals, pullEntries, pushChanges } = useSync();
  const [byDate, setByDate] = useState<{ date: string; count: number; avgScore: number }[]>([]);

  useFocusEffect(useCallback(() => {
    const from = '2000-01-01';
    const to = new Date().toISOString().split('T')[0];

    function processAndSet(all: Entry[]) {
      const map = new Map<string, number[]>();
      for (const e of all) {
        if (!map.has(e.date_note)) map.set(e.date_note, []);
        map.get(e.date_note)!.push(e.productivity_score);
      }
      setByDate(
        Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([date, scores]) => ({
            date,
            count: scores.length,
            avgScore: Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10,
          }))
      );
    }

    // Show local data immediately
    entries.getByDateRange(from, to).then(processAndSet);

    // Push any local unsynced entries, then pull fresh data from backend
    pullGoals()
      .then(pushChanges)
      .then(pullEntries)
      .then(() => entries.getByDateRange(from, to))
      .then(processAndSet);
  }, []));

  return (
    <View style={s.container}>
      <FlatList
        data={byDate}
        keyExtractor={item => item.date}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.header}>{t('notes.title')}</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => router.push(`/notes/${item.date}`)}>
            <View style={[s.stripe, { backgroundColor: stripeColor(item.avgScore) }]} />
            <View style={s.cardBody}>
              <Text style={s.date}>{formatDate(item.date)}</Text>
              <View style={s.meta}>
                <Text style={s.metaText}>{t('notes.entries', { count: item.count })}</Text>
                <Text style={[s.score, { color: scoreColor(item.avgScore) }]}>★ {item.avgScore}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>{t('notes.empty')}</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  list: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { fontSize: 22, fontWeight: '700', color: '#26215C', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', flexDirection: 'row' },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  date: { fontSize: 15, fontWeight: '600', color: '#2C2C2A', marginBottom: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 13, color: '#888780' },
  score: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9' },
});
