import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useReports } from '@/db/reports';

const C = {
  bg: '#F5F4F0', heroBg: '#EEEDFE', card: '#FFFFFF',
  purple: '#7F77DD', purpleMid: '#534AB7', purpleDark: '#26215C',
  textPrimary: '#2C2C2A', textSecondary: '#5F5E5A', textMuted: '#888780',
  border: '#EBEBEB', statBg: 'rgba(255,255,255,0.65)', subtleBg: '#F5F4F0',
};

const PILL_COLORS = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#E4DFFF', text: '#3D3590' },
  { bg: '#DDD8FF', text: '#26215C' },
  { bg: '#F0EEFF', text: '#6A63C4' },
];

function ExpandItem({ title, detail }: { title: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.expandItem}>
      <TouchableOpacity style={s.expandToggle} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={s.expandTitle}>{title}</Text>
        <Text style={[s.chev, open && s.chevOpen]}>›</Text>
      </TouchableOpacity>
      {open && <Text style={s.expandDetail}>{detail}</Text>}
    </View>
  );
}

function WorkedItem({ title, description, index }: { title: string; description: string; index: number }) {
  const [open, setOpen] = useState(false);
  const pc = PILL_COLORS[index % PILL_COLORS.length];
  return (
    <View style={s.wItem}>
      <TouchableOpacity style={s.wToggle} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={[s.wPill, { backgroundColor: pc.bg, color: pc.text }]}>{title}</Text>
        <Text style={[s.chev, open && s.chevOpen]}>›</Text>
      </TouchableOpacity>
      {open && <Text style={s.wDetail}>{description}</Text>}
    </View>
  );
}

export default function MonthReport() {
  const { period } = useLocalSearchParams<{ period: string }>();
  const reports = useReports();
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<{ avg_productivity: number | null; active_days: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reports.get('month', decodeURIComponent(period)).then(cached => {
      if (cached) {
        setData(JSON.parse(cached.data));
        setMeta({ avg_productivity: cached.avg_productivity, active_days: cached.active_days });
      }
      setLoading(false);
    });
  }, [period]);

  if (loading) return <ActivityIndicator style={s.loader} color={C.purple} />;
  if (!data) return <Text style={s.error}>Звіт не знайдено</Text>;

  const tone = data.tone ?? {};
  const activeSegs = tone.scale ? Array.from({ length: tone.scale }, (_, i) => i) : [];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>{data.title ?? ''}</Text>
        <Text style={s.heroSub}>{data.summary ?? ''}</Text>
        <View style={s.statsRow}>
          {meta?.avg_productivity != null && (
            <View style={s.statCard}>
              <Text style={s.statValue}>{meta.avg_productivity.toFixed(1)}</Text>
              <Text style={s.statLabel}>avg score</Text>
            </View>
          )}
          <View style={s.statCard}>
            <Text style={s.statValue}>{meta?.active_days ?? 0}</Text>
            <Text style={s.statLabel}>active days</Text>
          </View>
          {tone.word && (
            <View style={s.statCard}>
              <Text style={s.statValue}>{tone.word}</Text>
              <Text style={s.statLabel}>tone</Text>
            </View>
          )}
        </View>
      </View>

      {data.goals?.length > 0 && (
        <View style={s.card}>
          <Text style={s.clabel}>Goals</Text>
          {data.goals.map((g: any, i: number) => (
            <View key={i} style={[s.goalRow, i === 0 && s.goalFirst, i === data.goals.length - 1 && s.goalLast]}>
              <Text style={s.goalName}>{g.name}</Text>
              <Text style={s.goalSummary}>{g.summary}</Text>
              {g.comparison && (
                <View style={s.compBox}>
                  <Text style={s.compLabel}>Compared to past</Text>
                  <Text style={s.compText}>{g.comparison}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {tone.word && (
        <View style={s.card}>
          <Text style={s.clabel}>Tone of the month</Text>
          <View style={s.toneTop}>
            <Text style={s.toneWord}>{tone.word}</Text>
          </View>
          <View style={s.scale}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={[s.seg, activeSegs.includes(i) && s.segOn]} />
            ))}
          </View>
          <View style={s.scaleLabels}>
            <Text style={s.scaleLbl}>scattered</Text>
            <Text style={s.scaleLbl}>focused</Text>
          </View>
          <Text style={s.toneDesc}>{tone.description}</Text>
        </View>
      )}

      {data.patterns?.length > 0 && (
        <View style={s.card}>
          <Text style={s.clabel}>Patterns</Text>
          {data.patterns.map((p: any, i: number) => (
            <ExpandItem key={i} title={p.title} detail={p.description} />
          ))}
        </View>
      )}

      {data.what_worked?.length > 0 && (
        <View style={[s.card, s.workedCard]}>
          <Text style={[s.clabel, s.workedLabel]}>What worked</Text>
          {data.what_worked.map((w: any, i: number) => (
            <WorkedItem key={i} title={w.title} description={w.description} index={i} />
          ))}
        </View>
      )}

      {data.insight && (
        <View style={s.insightCard}>
          <Text style={s.insightLabel}>Insight</Text>
          <Text style={s.insightText}>{data.insight}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  loader: { flex: 1 },
  error: { flex: 1, textAlign: 'center', marginTop: 60, color: C.textMuted },
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, gap: 10, paddingBottom: 32 },
  hero: { backgroundColor: C.heroBg, borderRadius: 18, padding: 16 },
  heroEyebrow: { fontSize: 13, fontWeight: '600', color: C.purpleDark, marginBottom: 8 },
  heroSub: { fontSize: 13, color: C.purpleMid, lineHeight: 20, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 7 },
  statCard: { flex: 1, backgroundColor: C.statBg, borderRadius: 10, padding: 8, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '600', color: C.purpleDark },
  statLabel: { fontSize: 9, color: C.purple, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14 },
  clabel: { fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  goalRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  goalFirst: { paddingTop: 0 },
  goalLast: { borderBottomWidth: 0, paddingBottom: 0 },
  goalName: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginBottom: 5 },
  goalSummary: { fontSize: 12, color: C.textPrimary, lineHeight: 18, marginBottom: 6 },
  compBox: { backgroundColor: C.subtleBg, borderRadius: 8, padding: 8 },
  compLabel: { fontSize: 9, color: C.purple, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  compText: { fontSize: 11, color: C.purpleMid, lineHeight: 16 },
  toneTop: { marginBottom: 10, marginTop: 4 },
  toneWord: { fontSize: 24, fontWeight: '500', color: C.purpleDark },
  scale: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  segOn: { backgroundColor: C.purple },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scaleLbl: { fontSize: 9, color: '#B4B2A9' },
  toneDesc: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  expandItem: { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border },
  expandToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expandTitle: { fontSize: 13, fontWeight: '500', color: C.textPrimary, flex: 1, marginRight: 8 },
  expandDetail: { fontSize: 12, color: C.textSecondary, lineHeight: 19, paddingTop: 6 },
  chev: { fontSize: 18, color: '#C8C7C2' },
  chevOpen: { transform: [{ rotate: '90deg' }] },
  workedCard: { padding: 0, overflow: 'hidden' },
  workedLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 0, borderBottomWidth: 0.5, borderBottomColor: C.border },
  wItem: { borderBottomWidth: 0.5, borderBottomColor: C.border },
  wToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 16 },
  wPill: { fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, overflow: 'hidden', flex: 1, marginRight: 8 },
  wDetail: { fontSize: 12, color: C.textSecondary, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 12 },
  insightCard: { backgroundColor: C.purpleDark, borderRadius: 18, padding: 14 },
  insightLabel: { fontSize: 9, color: C.purple, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  insightText: { fontSize: 14, color: '#F1EFE8', lineHeight: 22, fontStyle: 'italic' },
});
