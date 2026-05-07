import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useReports } from '@/db/reports';

const C = {
  bg: '#F5F4F0', heroBg: '#26215C', card: '#FFFFFF',
  purple: '#7F77DD', purpleMid: '#534AB7', purpleDark: '#26215C',
  textPrimary: '#2C2C2A', textSecondary: '#5F5E5A', textMuted: '#888780',
  border: '#EBEBEB', subtleBg: '#F5F4F0',
};

const PILL_COLORS = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#EAF3DE', text: '#3B6D11' },
];

const GOAL_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: '#E1F5EE', text: '#0F6E56', label: 'active' },
  completed: { bg: '#EEEDFE', text: '#534AB7', label: 'completed' },
  paused:    { bg: '#F1EFE8', text: '#888780', label: 'paused' },
};

function ExpandItem({ title, since, detail }: { title: string; since?: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.expandItem}>
      <TouchableOpacity style={s.expandToggle} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.expandTitle}>{title}</Text>
          {since && <Text style={s.expandSince}>{since}</Text>}
        </View>
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

export default function YearReport() {
  const { period } = useLocalSearchParams<{ period: string }>();
  const reports = useReports();
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<{ avg_productivity: number | null; active_days: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reports.get('year', decodeURIComponent(period)).then(cached => {
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
  const highlights = data.highlights ?? {};
  const quarters = tone.trend ? Object.entries(tone.trend).map(([q, w]) => ({ label: q, word: w as string })) : [];

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

      {(highlights.best || highlights.hardest) && (
        <View style={s.hlGrid}>
          {highlights.best && (
            <View style={[s.hlCard, s.hlBest]}>
              <Text style={[s.hlTag, { color: '#0F6E56' }]}>Best moment</Text>
              <Text style={[s.hlPeriod, { color: '#085041' }]}>{highlights.best.period}</Text>
              <Text style={[s.hlReason, { color: '#0F6E56' }]}>{highlights.best.reason}</Text>
            </View>
          )}
          {highlights.hardest && (
            <View style={[s.hlCard, s.hlHard]}>
              <Text style={[s.hlTag, { color: '#993C1D' }]}>Hardest moment</Text>
              <Text style={[s.hlPeriod, { color: '#4A1B0C' }]}>{highlights.hardest.period}</Text>
              <Text style={[s.hlReason, { color: '#993C1D' }]}>{highlights.hardest.reason}</Text>
            </View>
          )}
        </View>
      )}

      {data.goals?.length > 0 && (
        <View style={s.card}>
          <Text style={s.clabel}>Goals</Text>
          {data.goals.map((g: any, i: number) => {
            const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.active;
            return (
              <View key={i} style={[s.goalRow, i === 0 && s.goalFirst, i === data.goals.length - 1 && s.goalLast]}>
                <View style={s.goalHeader}>
                  <Text style={s.goalName}>{g.name}</Text>
                  <Text style={[s.goalStatus, { backgroundColor: st.bg, color: st.text }]}>{st.label}</Text>
                </View>
                <Text style={s.goalSummary}>{g.summary}</Text>
                {g.comparison && (
                  <View style={[s.goalBox, { backgroundColor: C.subtleBg, marginBottom: 5 }]}>
                    <Text style={[s.boxLabel, { color: C.purple }]}>Compared to start of year</Text>
                    <Text style={[s.boxText, { color: C.purpleMid }]}>{g.comparison}</Text>
                  </View>
                )}
                {g.peak && (
                  <View style={[s.goalBox, { backgroundColor: '#FAEEDA' }]}>
                    <Text style={[s.boxLabel, { color: '#BA7517' }]}>Best moment</Text>
                    <Text style={[s.boxText, { color: '#854F0B' }]}>{g.peak}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {tone.word && (
        <View style={s.card}>
          <Text style={s.clabel}>Tone of the year</Text>
          <Text style={s.toneWord}>{tone.word}</Text>
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
          {quarters.length > 0 && (
            <View style={s.trendBox}>
              <Text style={s.trendLabel}>По кварталах</Text>
              <View style={s.trendRow}>
                {quarters.map((q, i) => (
                  <View key={i} style={s.trendQ}>
                    <Text style={s.tqLabel}>{q.label}</Text>
                    <Text style={s.tqWord}>{q.word}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {data.patterns?.length > 0 && (
        <View style={s.card}>
          <Text style={s.clabel}>Patterns</Text>
          {data.patterns.map((p: any, i: number) => (
            <ExpandItem key={i} title={p.title} since={p.first_seen} detail={p.description} />
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
  heroEyebrow: { fontSize: 13, fontWeight: '600', color: '#F1EFE8', marginBottom: 8 },
  heroSub: { fontSize: 13, color: '#AFA9EC', lineHeight: 20, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 7 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '600', color: '#F1EFE8' },
  statLabel: { fontSize: 9, color: C.purple, marginTop: 2 },
  hlGrid: { flexDirection: 'row', gap: 8 },
  hlCard: { flex: 1, borderRadius: 14, padding: 12 },
  hlBest: { backgroundColor: '#E1F5EE' },
  hlHard: { backgroundColor: '#FAECE7' },
  hlTag: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  hlPeriod: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  hlReason: { fontSize: 11, lineHeight: 16 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14 },
  clabel: { fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  goalRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  goalFirst: { paddingTop: 0 },
  goalLast: { borderBottomWidth: 0, paddingBottom: 0 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  goalName: { fontSize: 13, fontWeight: '600', color: C.textPrimary, flex: 1, marginRight: 8 },
  goalStatus: { fontSize: 10, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20, overflow: 'hidden' },
  goalSummary: { fontSize: 12, color: C.textPrimary, lineHeight: 18, marginBottom: 6 },
  goalBox: { borderRadius: 8, padding: 8, marginBottom: 5 },
  boxLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  boxText: { fontSize: 11, lineHeight: 16 },
  toneWord: { fontSize: 24, fontWeight: '500', color: C.purpleDark, marginBottom: 10, marginTop: 4 },
  scale: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  segOn: { backgroundColor: C.purple },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scaleLbl: { fontSize: 9, color: '#B4B2A9' },
  toneDesc: { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 6 },
  trendBox: { backgroundColor: C.subtleBg, borderRadius: 8, padding: 8 },
  trendLabel: { fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  trendRow: { flexDirection: 'row', gap: 6 },
  trendQ: { flex: 1, alignItems: 'center' },
  tqLabel: { fontSize: 9, color: '#B4B2A9', marginBottom: 3 },
  tqWord: { fontSize: 11, fontWeight: '500', color: C.textPrimary },
  expandItem: { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border },
  expandToggle: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  expandTitle: { fontSize: 13, fontWeight: '500', color: C.textPrimary, lineHeight: 18 },
  expandSince: { fontSize: 10, color: '#B4B2A9', marginTop: 2 },
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
