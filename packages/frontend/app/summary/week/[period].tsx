import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

const C = {
  bg: '#F5F4F0',
  heroBg: '#EEEDFE',
  card: '#FFFFFF',
  purple: '#7F77DD',
  purpleMid: '#534AB7',
  purpleDark: '#26215C',
  textPrimary: '#2C2C2A',
  textSecondary: '#5F5E5A',
  textMuted: '#888780',
  border: '#EBEBEB',
  statBg: 'rgba(255,255,255,0.65)',
};

const PILL_COLORS = {
  teal:   { bg: '#E1F5EE', text: '#0F6E56' },
  purple: { bg: '#EEEDFE', text: '#534AB7' },
  coral:  { bg: '#FAECE7', text: '#993C1D' },
  amber:  { bg: '#FAEEDA', text: '#854F0B' },
  green:  { bg: '#EAF3DE', text: '#3B6D11' },
};

const MOCK = {
  eyebrow: 'Weekly Report · Jul 28 – Aug 3',
  headline: 'Turning repetition into real skill',
  sub: 'This week centered on building momentum with a clear training structure while practicing a calmer, more adaptive mindset in the gym.',
  stats: [
    { value: '12wk', label: 'plan started' },
    { value: '4', label: 'tone score' },
    { value: 'Steady', label: 'week mood' },
  ],
  goals: [
    {
      name: 'Complete a 12-week strength training plan',
      score: 'Week 1 · on track',
      progress: 0.08,
      color: '#7F77DD',
      note: 'You started the plan and mapped out your first week. Notable wins: one of your best sessions of the month when rested, and choosing smart adjustments (lighter work, walking/stretching) as part of the plan rather than a setback.',
    },
  ],
  tone: {
    word: 'Steady',
    sub: 'consistent effort, practical self-management',
    activeSegs: [0, 1, 2, 3],
    total: 7,
    leftLabel: 'scattered',
    rightLabel: 'focused',
    desc: 'You showed repeated follow-through and kept training moving forward even when motivation and confidence fluctuated. The week\'s pattern was consistent effort plus practical self-management — warm-ups, bracing, and mobility — so the work stayed productive.',
  },
  worked: [
    {
      pill: 'Writing the plan and keeping structure',
      color: 'purple' as keyof typeof PILL_COLORS,
      detail: 'Starting the 12-week plan and writing out week one made it easier to show up and execute because you knew exactly what you were doing.',
    },
    {
      pill: 'Leaning on discipline when motivation dipped',
      color: 'teal' as keyof typeof PILL_COLORS,
      detail: 'You still completed sessions on mentally hard days, which kept momentum and reinforced your identity as someone who follows through.',
    },
    {
      pill: 'Warm-up, bracing, and patience with technique',
      color: 'coral' as keyof typeof PILL_COLORS,
      detail: 'Improving your warm-up and bracing helped your confidence return and made sessions feel smoother and more controlled.',
    },
    {
      pill: 'Mobility and recovery as part of training',
      color: 'amber' as keyof typeof PILL_COLORS,
      detail: 'Adding mobility work and using lighter days (walk/stretching) helped you stay consistent while managing soreness and fatigue.',
    },
  ],
};

function WorkedItem({ pill, color, detail }: { pill: string; color: keyof typeof PILL_COLORS; detail: string }) {
  const [open, setOpen] = useState(false);
  const pc = PILL_COLORS[color];
  return (
    <View style={s.wItem}>
      <TouchableOpacity style={s.wToggle} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={[s.wPill, { backgroundColor: pc.bg, color: pc.text }]}>{pill}</Text>
        <Text style={[s.wChev, open && s.wChevOpen]}>›</Text>
      </TouchableOpacity>
      {open && <Text style={s.wDetail}>{detail}</Text>}
    </View>
  );
}

export default function WeekReport() {
  useLocalSearchParams<{ period: string }>();
  const d = MOCK;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>{d.eyebrow}</Text>
        <Text style={s.heroHeadline}>{d.headline}</Text>
        <Text style={s.heroSub}>{d.sub}</Text>
        <View style={s.statsRow}>
          {d.stats.map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Goals */}
      <View style={s.card}>
        <Text style={s.clabel}>Goals</Text>
        {d.goals.map((g, i) => (
          <View key={i} style={[s.goalRow, i === 0 && s.goalFirst, i === d.goals.length - 1 && s.goalLast]}>
            <View style={s.goalHeader}>
              <Text style={s.goalName}>{g.name}</Text>
              <Text style={s.goalScore}>{g.score}</Text>
            </View>
            <View style={s.barBg}>
              <View style={[s.bar, { width: `${g.progress * 100}%` as any, backgroundColor: g.color }]} />
            </View>
            <Text style={s.goalNote}>{g.note}</Text>
          </View>
        ))}
      </View>

      {/* Tone */}
      <View style={s.card}>
        <Text style={s.clabel}>Tone of the week</Text>
        <View style={s.toneTop}>
          <Text style={s.toneWord}>{d.tone.word}</Text>
          <Text style={s.toneSub}>{d.tone.sub}</Text>
        </View>
        <View style={s.scale}>
          {Array.from({ length: d.tone.total }).map((_, i) => (
            <View key={i} style={[s.seg, d.tone.activeSegs.includes(i) && s.segOn]} />
          ))}
        </View>
        <View style={s.scaleLabels}>
          <Text style={s.scaleLbl}>{d.tone.leftLabel}</Text>
          <Text style={s.scaleLbl}>{d.tone.rightLabel}</Text>
        </View>
        <Text style={s.toneDesc}>{d.tone.desc}</Text>
      </View>

      {/* What worked */}
      <View style={[s.card, s.workedCard]}>
        <Text style={[s.clabel, s.workedLabel]}>What worked</Text>
        {d.worked.map((w, i) => (
          <WorkedItem key={i} {...w} />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, gap: 10, paddingBottom: 32 },

  hero: { backgroundColor: C.heroBg, borderRadius: 18, padding: 16 },
  heroEyebrow: { fontSize: 9, color: C.purple, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  heroHeadline: { fontSize: 22, fontWeight: '500', color: C.purpleDark, lineHeight: 28, marginBottom: 6, fontFamily: 'serif' },
  heroSub: { fontSize: 13, color: C.purpleMid, lineHeight: 20, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 7 },
  statCard: { flex: 1, backgroundColor: C.statBg, borderRadius: 10, padding: 8, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '500', color: C.purpleDark },
  statLabel: { fontSize: 9, color: C.purple, marginTop: 2 },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 14 },
  clabel: { fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  goalRow: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  goalFirst: { paddingTop: 0 },
  goalLast: { borderBottomWidth: 0, paddingBottom: 0 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  goalName: { fontSize: 13, fontWeight: '500', color: C.textPrimary },
  goalScore: { fontSize: 12, color: C.textMuted },
  barBg: { height: 3, backgroundColor: C.border, borderRadius: 2, marginBottom: 5 },
  bar: { height: 3, borderRadius: 2 },
  goalNote: { fontSize: 12, color: C.textSecondary, lineHeight: 17 },

  toneTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10, marginTop: 6 },
  toneWord: { fontSize: 26, fontWeight: '500', color: C.purpleDark, fontFamily: 'serif' },
  toneSub: { fontSize: 11, color: C.textMuted },
  scale: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  segOn: { backgroundColor: C.purple },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  scaleLbl: { fontSize: 9, color: '#B4B2A9' },
  toneDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  workedCard: { padding: 0, overflow: 'hidden' },
  workedLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 0, borderBottomWidth: 0.5, borderBottomColor: C.border },
  wItem: { borderBottomWidth: 0.5, borderBottomColor: C.border },
  wToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 16 },
  wPill: { fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, overflow: 'hidden' },
  wChev: { fontSize: 18, color: '#C8C7C2' },
  wChevOpen: { transform: [{ rotate: '90deg' }] },
  wDetail: { fontSize: 12, color: C.textSecondary, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 12 },
});
