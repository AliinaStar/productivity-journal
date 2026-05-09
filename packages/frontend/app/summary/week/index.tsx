import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useReports } from '@/db/reports';
import { useSync } from '@/hooks/useSync';
import { ReportCache } from '@/db/types';
import { toPeriodKey, periodLabel } from '@/utils/period';

export default function WeekList() {
  const { t } = useTranslation();
  const router = useRouter();
  const reports = useReports();
  const { syncReports } = useSync();
  const [items, setItems] = useState<ReportCache[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    async function load() {
      try { await syncReports('week'); } catch (e) { console.error('syncReports error:', e); }
      const data = await reports.getAll('week');
      setItems(data);
      setLoading(false);
    }
    load();
  }, []));

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.header}>{t('summary.weeks')}</Text>
      {loading ? (
        <ActivityIndicator color="#7F77DD" />
      ) : items.length === 0 ? (
        <Text style={s.empty}>{t('summary.noReports')}</Text>
      ) : (
        items.map(item => {
          const key = toPeriodKey('week', item.period_start);
          const label = periodLabel('week', item.period_start, item.period_end);
          return (
            <TouchableOpacity
              key={key}
              style={s.card}
              onPress={() => router.push(`/summary/week/${encodeURIComponent(key)}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardTop}>
                <Text style={s.cardLabel}>{label}</Text>
                {item.avg_productivity != null && (
                  <Text style={s.cardScore}>{item.avg_productivity.toFixed(1)} avg</Text>
                )}
              </View>
              <Text style={s.cardMeta}>{t('summary.activeDays', { count: item.active_days })}</Text>
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
  header: { fontSize: 22, fontWeight: '700', color: '#26215C', marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  cardScore: { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  cardMeta: { fontSize: 12, color: '#B4B2A9' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#B4B2A9' },
});
