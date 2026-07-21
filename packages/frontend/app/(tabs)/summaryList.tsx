import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useReports } from '@/db/reports';
import { useSync } from '@/hooks/useSync';
import { ReportCache, PeriodType } from '@/db/types';
import { periodLabel } from '@/utils/period';

const TABS: PeriodType[] = ['week', 'month', 'year'];

interface ReportData {
  title?: string;
  summary?: string;
}

export default function OverviewScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reportsDb = useReports();
  const { syncReports } = useSync();
  const [tab, setTab] = useState<PeriodType>('week');
  const [items, setItems] = useState<ReportCache[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      try { await syncReports(tab); } catch {}
      setItems(await reportsDb.getAll(tab));
      setLoading(false);
    })();
  }, [tab]));

  const [latest, ...rest] = items;
  const latestData: ReportData = latest ? reportsDb.parse<ReportData>(latest) : {};

  function openPeriod(periodKey: string) {
    router.push(`/summary/${tab}/${encodeURIComponent(periodKey)}`);
  }

  return (
    <View style={s.container}>
      <Text style={[s.title, { paddingTop: insets.top + 14 }]}>{t('overview.title')}</Text>
      <Text style={s.subtitle}>{t('overview.subtitle')}</Text>

      <View style={s.tabRow}>
        {TABS.map(key => (
          <Pressable key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{t(`summary.${key}Tab`)}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} color="#7F77DD" />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.period_key}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            latest ? (
              <Pressable onPress={() => openPeriod(latest.period_key)}>
                <LinearGradient colors={['#534AB7', '#7F77DD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                  <Text style={s.heroPeriod}>
                    {periodLabel(tab, latest.period_start, latest.period_end).toUpperCase()}
                  </Text>
                  {latestData.title ? <Text style={s.heroHeadline}>{latestData.title}</Text> : null}
                  {latestData.summary ? <Text style={s.heroBody}>{latestData.summary}</Text> : null}
                </LinearGradient>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => openPeriod(item.period_key)}>
              <View style={s.cardTextCol}>
                <Text style={s.cardTitle}>{periodLabel(tab, item.period_start, item.period_end)}</Text>
                <Text style={s.cardMeta}>
                  {t('summary.activeDays', { count: item.active_days })}
                  {item.avg_productivity != null ? ` · ★${item.avg_productivity.toFixed(1)}` : ''}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={!latest ? <Text style={s.empty}>{t('summary.noReports')}</Text> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  title: { fontSize: 24, fontWeight: '800', color: '#26215C', letterSpacing: -0.3, paddingHorizontal: 22, paddingTop: 16 },
  subtitle: { fontSize: 12, color: '#928F87', marginTop: 3, paddingHorizontal: 22 },

  tabRow: { flexDirection: 'row', backgroundColor: '#EEECE6', borderRadius: 13, padding: 3, marginHorizontal: 22, marginTop: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: '600', color: '#8C8A82' },
  tabTextActive: { color: '#26215C', fontWeight: '700' },

  loader: { flex: 1 },
  list: { padding: 22, paddingTop: 16, gap: 10, paddingBottom: 32 },

  hero: { borderRadius: 20, padding: 18, marginBottom: 4 },
  heroPeriod: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.4 },
  heroHeadline: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 8, lineHeight: 24 },
  heroBody: { fontSize: 12.5, color: 'rgba(255,255,255,0.9)', marginTop: 8, lineHeight: 19 },

  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTextCol: {},
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#2C2C2A' },
  cardMeta: { fontSize: 11, color: '#928F87', marginTop: 2 },
  chevron: { fontSize: 13, fontWeight: '600', color: '#B4B2A9' },

  empty: { textAlign: 'center', marginTop: 60, fontSize: 14, color: '#B4B2A9' },
});
