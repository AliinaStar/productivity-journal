import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useGoals } from '@/db/goals';
import { useSync } from '@/hooks/useSync';
import { Goal } from '@/db/types';

export default function HomeScreen() {
  const goals = useGoals();
  const { sync, syncing } = useSync();
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await goals.getActive();
    setItems(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleSync() {
    await sync();
    await load();
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.quote}>Маленькі кроки щодня → великі зміни</Text>
        <Pressable onPress={handleSync} disabled={syncing} style={s.syncBtn}>
          <Text style={s.syncText}>{syncing ? 'Синхронізація...' : 'Синк'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} color="#7F77DD" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable style={s.goalCard} onPress={() => router.push(`/goal/${item.id}`)}>
              <Text style={s.goalTitle}>{item.title}</Text>
              {item.description ? <Text style={s.goalDesc}>{item.description}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={s.empty}>Немає активних цілей.{'\n'}Натисни + щоб додати.</Text>
          }
        />
      )}

      <Pressable style={s.fab} onPress={() => router.push('/goal')}>
        <Text style={s.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  quote: { fontSize: 15, fontWeight: '600', color: '#26215C', flex: 1 },
  syncBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EEEDFE', borderRadius: 8 },
  syncText: { fontSize: 12, color: '#534AB7', fontWeight: '500' },
  loader: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 80 },
  goalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  goalTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  goalDesc: { fontSize: 13, color: '#888780', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9', lineHeight: 22 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7F77DD', alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
