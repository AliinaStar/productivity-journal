import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useEntries } from '@/db/entries';
import { useGoals } from '@/db/goals';
import { Entry, Goal } from '@/db/types';

export default function NoteDetail() {
  const { t } = useTranslation();
  const { id: date } = useLocalSearchParams<{ id: string }>();
  const entries = useEntries();
  const goals = useGoals();
  const [items, setItems] = useState<(Entry & { goalTitle: string })[]>([]);

  useEffect(() => {
    async function load() {
      const all = await entries.getByDateRange(date, date);
      const goalMap = new Map<string, Goal>();
      for (const e of all) {
        if (!goalMap.has(e.goal_id)) {
          const g = await goals.getById(e.goal_id);
          if (g) goalMap.set(e.goal_id, g);
        }
      }
      setItems(all.map(e => ({ ...e, goalTitle: goalMap.get(e.goal_id)?.title ?? '—' })));
    }
    load();
  }, [date]);

  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  const formatted = new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.dateTitle}>{formatted}</Text>
      {items.length === 0 ? (
        <Text style={s.empty}>{t('notes.noEntries')}</Text>
      ) : (
        items.map(item => (
          <View key={item.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.goalName}>{item.goalTitle}</Text>
              <Text style={s.score}>{'★'.repeat(item.productivity_score)}</Text>
            </View>
            <Text style={s.note}>{item.note}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  dateTitle: { fontSize: 20, fontWeight: '600', color: '#26215C', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalName: { fontSize: 13, fontWeight: '600', color: '#534AB7', flex: 1, marginRight: 8 },
  score: { fontSize: 14, color: '#F5B73C' },
  note: { fontSize: 14, color: '#2C2C2A', lineHeight: 21 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9' },
});
