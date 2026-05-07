import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useReports } from '@/db/reports';
import { useSync } from '@/hooks/useSync';
import { ReportCache } from '@/db/types';
import { toPeriodKey } from '@/utils/period';

export default function YearList() {
  const router = useRouter();
  const reports = useReports();
  const { syncReports } = useSync();
  const [items, setItems] = useState<ReportCache[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    async function load() {
      try { await syncReports('year'); } catch {}
      const data = await reports.getAll('year');
      setItems(data);
      setLoading(false);
    }
    load();
  }, []));

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.header}>Yearly reports</Text>
      {loading ? (
        <ActivityIndicator color="#7F77DD" />
      ) : items.length === 0 ? (
        <Text style={s.empty}>Немає збережених звітів</Text>
      ) : (
        items.map(item => {
          const key = toPeriodKey('year', item.period_start);
          const data = item.data ? JSON.parse(item.data) : null;
          return (
            <TouchableOpacity
              key={key}
              style={s.card}
              onPress={() => router.push(`/summary/year/${encodeURIComponent(key)}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardTop}>
                <Text style={s.cardLabel}>{key}</Text>
                {item.avg_productivity != null && (
                  <Text style={s.cardScore}>{item.avg_productivity.toFixed(1)} avg</Text>
                )}
              </View>
              {data?.summary ? (
                <Text style={s.cardHeadline} numberOfLines={2}>{data.summary}</Text>
              ) : null}
              <View style={s.cardBottom}>
                <Text style={s.cardMeta}>{item.active_days} активних днів</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  header: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  card: { backgroundColor: '#26215C', borderRadius: 16, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#F1EFE8' },
  cardScore: { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  cardHeadline: { fontSize: 13, color: '#AFA9EC', marginBottom: 8, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', gap: 6 },
  cardMeta: { fontSize: 12, color: '#7F77DD' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#B4B2A9' },
});
