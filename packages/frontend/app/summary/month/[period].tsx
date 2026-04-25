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
  subtleBg: '#F5F4F0',
};

const PILL_COLORS = {
  teal:   { bg: '#E1F5EE', text: '#0F6E56' },
  purple: { bg: '#EEEDFE', text: '#534AB7' },
  coral:  { bg: '#FAECE7', text: '#993C1D' },
  amber:  { bg: '#FAEEDA', text: '#854F0B' },
  green:  { bg: '#EAF3DE', text: '#3B6D11' },
};

const MOCK = {
  eyebrow: 'October 2025 · Monthly report',
  headline: 'From starting to operating',
  sub: 'October was a pivot: you consolidated repeatable systems across goals and then used them to produce real output.',
  stats: [
    { value: '3',      label: 'active goals' },
    { value: '5',      label: 'tone score' },
    { value: 'Focused', label: 'month mood' },
  ],
  goals: [
    {
      name: 'Запустити персональний блог про подорожі',
      score: 'goal #45 · on track',
      progress: 0.65,
      color: '#1D9E75',
      summary: 'The month\'s trajectory moved from foundational setup into a repeatable publishing system. You locked in domain/name, site skeleton (Home/About/Articles/Contacts), theme, branding, and analytics. Mid-month you completed the first full article end-to-end (draft → edit → upload) and practiced distribution via short social teasers. You built a post template, a 3-month content plan, and lightweight operating rules like "one article + one technical fix + one backup idea."',
      comparison: 'Compared with earlier periods where you were consuming advice and feeling overwhelmed, October shows a decisive shift toward shipping and iterating. The site structure that once felt like "not just an idea in your head" is now an operational workflow with the first full article published.',
    },
    {
      name: 'Накопичити фінансову подушку',
      score: 'goal #46 · on track',
      progress: 0.55,
      color: '#7F77DD',
      summary: 'This month reinforced the shift from occasional saving to a repeatable "pay yourself first" system. You emphasized early-in-month transfers and micro-top-ups sourced from avoided spending (cheaper lunches, skipped coffees/orders). Consistent logging and weekly spend reviews helped you spot patterns and act on them rather than rely on willpower.',
      comparison: 'Continues the system-hardening seen in past entries. What\'s changed is the consistency of converting small avoided purchases (especially coffee/delivery) into direct deposits, making progress less dependent on a single "big" decision.',
    },
    {
      name: 'Повернутися до регулярних тренувань',
      score: 'goal #47 · on track',
      progress: 0.70,
      color: '#D85A30',
      summary: 'October continued the identity-level focus: rebuilding a durable training habit rather than chasing peak performance. You repeatedly returned to a stable template (warm-up → full-body strength → cardio on treadmill/bike/elliptical → stretching/mobility). The month\'s strength was self-regulation: shortening sessions or switching modalities while still preserving continuity.',
      comparison: 'Relative to earlier "just move again" periods (20-minute home sessions to restart), October reflects a more automatic return to the full scheme with less internal resistance. Protect continuity first, then build structure — that principle remains central.',
    },
  ],
  tone: {
    word: 'Focused',
    sub: 'systems over willpower',
    activeSegs: [3, 4, 5, 6],
    total: 7,
    leftLabel: 'scattered',
    rightLabel: 'focused',
    desc: 'You consistently chose repeatable systems over one-off effort — publishing rules for the blog, pay-yourself-first mechanics for savings, and a stable training template. Friction still appeared, but you treated it as something to iterate on, which kept the month moving in a clear direction.',
    trend: 'Early October — setup & foundations. Mid-month — first full outputs shipped. Late October — lightweight rules locked in, operating cadence established.',
  },
  patterns: [
    {
      title: 'Systems over willpower',
      detail: 'Across goals you repeatedly built structures that make action easier: a blog post template + operating rules, separate-account saving with tracking, and a default workout sequence. Your response to friction was to simplify the next step rather than negotiate with yourself.',
    },
    {
      title: 'Iterate in public (ship, then refine)',
      detail: 'On the blog, the dominant pattern was publishing imperfectly and improving through small UX/content upgrades (navigation tweaks, decluttering, popular blocks, About iterations). The same iterative posture appears in finances and training via reviews and self-regulation.',
    },
    {
      title: 'Low-energy re-entry strategies',
      detail: 'When energy was limited, you leaned on lighter actions that kept the thread unbroken: low-energy edits/walks to return to the blog, micro-deposits from "found money," and scaled sessions (short cardio, reduced load) in training.',
    },
  ],
  worked: [
    { pill: 'Lightweight operating rules', color: 'teal' as keyof typeof PILL_COLORS, detail: 'Using a simple rule like "one article + one technical fix + one backup idea" helped turn the blog from setup work into a repeatable publishing cadence.' },
    { pill: 'Tracking + weekly reviews', color: 'purple' as keyof typeof PILL_COLORS, detail: 'Reviewing spending and logging it in notes/tables made it easier to catch coffee/delivery creep and redirect that saved amount into the cushion.' },
    { pill: 'Good-enough training template', color: 'coral' as keyof typeof PILL_COLORS, detail: 'Defaulting to a basic full-body + short cardio structure (including 25-minute treadmill blocks) reduced resistance and kept consistency high even on tired days.' },
  ],
  insight: 'Your best progress this month came from treating each goal as an operating system: a clear default workflow plus a small feedback loop (analytics/UX tweaks, spend reviews, session self-regulation). October shows you converting ambiguity into routines that produce output — by making the next action smaller than the friction.',
};

function PatternItem({ title, detail }: { title: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.patternItem}>
      <TouchableOpacity style={s.patternToggle} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={s.patternTitle}>{title}</Text>
        <Text style={[s.pChev, open && s.pChevOpen]}>›</Text>
      </TouchableOpacity>
      {open && <Text style={s.patternDetail}>{detail}</Text>}
    </View>
  );
}

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

export default function MonthReport() {
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
            <Text style={s.goalSummary}>{g.summary}</Text>
            <View style={s.compBox}>
              <Text style={s.compLabel}>Compared to past</Text>
              <Text style={s.compText}>{g.comparison}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Tone */}
      <View style={s.card}>
        <Text style={s.clabel}>Tone of the month</Text>
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
        <View style={s.trendBox}>
          <Text style={s.trendLabel}>Як змінювався тон</Text>
          <Text style={s.trendText}>{d.tone.trend}</Text>
        </View>
      </View>

      {/* Patterns */}
      <View style={s.card}>
        <Text style={s.clabel}>Patterns</Text>
        {d.patterns.map((p, i) => (
          <PatternItem key={i} {...p} />
        ))}
      </View>

      {/* What worked */}
      <View style={[s.card, s.workedCard]}>
        <Text style={[s.clabel, s.workedLabel]}>What worked</Text>
        {d.worked.map((w, i) => (
          <WorkedItem key={i} {...w} />
        ))}
      </View>

      {/* Insight */}
      <View style={s.insightCard}>
        <Text style={s.insightLabel}>Insight</Text>
        <Text style={s.insightText}>{d.insight}</Text>
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

  goalRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  goalFirst: { paddingTop: 0 },
  goalLast: { borderBottomWidth: 0, paddingBottom: 0 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  goalName: { fontSize: 13, fontWeight: '500', color: C.textPrimary },
  goalScore: { fontSize: 12, color: C.textMuted },
  barBg: { height: 3, backgroundColor: C.border, borderRadius: 2, marginBottom: 6 },
  bar: { height: 3, borderRadius: 2 },
  goalSummary: { fontSize: 12, color: C.textPrimary, lineHeight: 18, marginBottom: 6 },
  compBox: { backgroundColor: C.subtleBg, borderRadius: 8, padding: 8 },
  compLabel: { fontSize: 9, color: C.purple, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  compText: { fontSize: 11, color: C.purpleMid, lineHeight: 16 },

  toneTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10, marginTop: 6 },
  toneWord: { fontSize: 26, fontWeight: '500', color: C.purpleDark, fontFamily: 'serif' },
  toneSub: { fontSize: 11, color: C.textMuted },
  scale: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  segOn: { backgroundColor: C.purple },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scaleLbl: { fontSize: 9, color: '#B4B2A9' },
  toneDesc: { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 6 },
  trendBox: { backgroundColor: C.subtleBg, borderRadius: 8, padding: 8 },
  trendLabel: { fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  trendText: { fontSize: 11, color: C.textSecondary, lineHeight: 16 },

  patternItem: { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border },
  patternToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  patternTitle: { fontSize: 13, fontWeight: '500', color: C.textPrimary, flex: 1, marginRight: 8 },
  pChev: { fontSize: 18, color: '#C8C7C2' },
  pChevOpen: { transform: [{ rotate: '90deg' }] },
  patternDetail: { fontSize: 12, color: C.textSecondary, lineHeight: 19, paddingTop: 6 },

  workedCard: { padding: 0, overflow: 'hidden' },
  workedLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 0, borderBottomWidth: 0.5, borderBottomColor: C.border },
  wItem: { borderBottomWidth: 0.5, borderBottomColor: C.border },
  wToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 16 },
  wPill: { fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, overflow: 'hidden' },
  wChev: { fontSize: 18, color: '#C8C7C2' },
  wChevOpen: { transform: [{ rotate: '90deg' }] },
  wDetail: { fontSize: 12, color: C.textSecondary, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 12 },

  insightCard: { backgroundColor: C.purpleDark, borderRadius: 18, padding: 14 },
  insightLabel: { fontSize: 9, color: C.purple, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  insightText: { fontSize: 14, color: '#F1EFE8', lineHeight: 22, fontFamily: 'serif', fontStyle: 'italic' },
});
