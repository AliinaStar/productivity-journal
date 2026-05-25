import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useReports } from '@/db/reports';
import { useSync } from '@/hooks/useSync';
import { ReportCache } from '@/db/types';
import { toPeriodKey, periodLabel } from '@/utils/period';

function currentMonthDates(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function MonthList() {
  const { t } = useTranslation();
  const router = useRouter();
  const reports = useReports();
  const { syncReports, generateReport } = useSync();
  const [items, setItems] = useState<ReportCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try { await syncReports('month'); } catch {}
    const data = await reports.getAll('month');
    setItems(data);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { start, end } = currentMonthDates();
      await generateReport('month', toPeriodKey('month', start), start, end);
      await load();
    } catch {
      Alert.alert(t('summary.generateError'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.header}>{t('summary.months')}</Text>
        <TouchableOpacity style={s.genBtn} onPress={handleGenerate} disabled={generating} activeOpacity={0.7}>
          {generating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.genBtnText}>{t('summary.generate')}</Text>}
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color="#7F77DD" />
      ) : items.length === 0 ? (
        <Text style={s.empty}>{t('summary.noReports')}</Text>
      ) : (
        items.map(item => {
          const key = toPeriodKey('month', item.period_start);
          const label = periodLabel('month', item.period_start, item.period_end);
          const data = item.data ? JSON.parse(item.data) : null;
          return (
            <TouchableOpacity
              key={key}
              style={s.card}
              onPress={() => router.push(`/summary/month/${encodeURIComponent(key)}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardTop}>
                <Text style={s.cardLabel}>{label}</Text>
                {item.avg_productivity != null && (
                  <Text style={s.cardScore}>{item.avg_productivity.toFixed(1)} avg</Text>
                )}
              </View>
              {data?.summary ? <Text style={s.cardHeadline} numberOfLines={2}>{data.summary}</Text> : null}
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
  header: { fontSize: 22, fontWeight: '700', color: '#26215C' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  genBtn: { backgroundColor: '#7F77DD', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  genBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  cardScore: { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  cardHeadline: { fontSize: 13, color: '#5F5E5A', marginBottom: 4, lineHeight: 18 },
  cardMeta: { fontSize: 12, color: '#B4B2A9' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#B4B2A9' },
});
