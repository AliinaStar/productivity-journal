import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useEntries } from '@/db/entries';
import { Entry } from '@/db/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function NotesList() {
  const entries = useEntries();
  const [byDate, setByDate] = useState<{ date: string; count: number; avgScore: number }[]>([]);

  useFocusEffect(useCallback(() => {
    const from = '2000-01-01';
    const to = new Date().toISOString().split('T')[0];
    entries.getByDateRange(from, to).then((all: Entry[]) => {
      const map = new Map<string, number[]>();
      for (const e of all) {
        if (!map.has(e.date_note)) map.set(e.date_note, []);
        map.get(e.date_note)!.push(e.productivity_score);
      }
      const result = Array.from(map.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, scores]) => ({
          date,
          count: scores.length,
          avgScore: Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10,
        }));
      setByDate(result);
    });
  }, []));

  return (
    <View style={s.container}>
      <FlatList
        data={byDate}
        keyExtractor={item => item.date}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.header}>Нотатки</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => router.push(`/notes/${item.date}`)}>
            <Text style={s.date}>{formatDate(item.date)}</Text>
            <View style={s.meta}>
              <Text style={s.metaText}>{item.count} {item.count === 1 ? 'запис' : 'записів'}</Text>
              <Text style={s.score}>★ {item.avgScore}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={s.empty}>Нотаток ще немає</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  list: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  date: { fontSize: 15, fontWeight: '600', color: '#2C2C2A', marginBottom: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 13, color: '#888780' },
  score: { fontSize: 13, color: '#F5B73C', fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9' },
});
