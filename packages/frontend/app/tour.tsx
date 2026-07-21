import { ReactNode, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { useSyncMeta } from '@/db/sync';
import { NavIcon, NavShape } from '@/components/nav-icon';

const STEPS = ['welcome', 'newGoal', 'record', 'manage', 'history', 'overview', 'done'] as const;
const LAST = STEPS.length - 1;

function todayLabel() {
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---- Mock building blocks (illustrative previews of real screens) ----

function Dim({ children }: { children: ReactNode }) {
  return <View style={{ opacity: 0.4 }}>{children}</View>;
}

function GoalCardMock({
  title,
  sub,
  subColor,
  trailing,
  highlight,
}: {
  title: string;
  sub: string;
  subColor: string;
  trailing?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <View style={[m.card, highlight && m.highlight]}>
      <View style={m.cardTextCol}>
        <Text style={m.cardTitle}>{title}</Text>
        <Text style={[m.cardSub, { color: subColor }]}>{sub}</Text>
      </View>
      {trailing}
    </View>
  );
}

function PlusCircle({ filled }: { filled?: boolean }) {
  return (
    <View style={[m.plus, filled ? m.plusFilled : m.plusHollow]}>
      <Text style={[m.plusText, { color: filled ? '#fff' : '#7F77DD' }]}>＋</Text>
    </View>
  );
}

// A checkmark drawn from an "L" of borders rotated 45° — no glyph/emoji needed.
function Check({ size, thickness, color }: { size: number; thickness: number; color: string }) {
  return (
    <View
      style={{
        width: size * 0.5,
        height: size,
        borderRightWidth: thickness,
        borderBottomWidth: thickness,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -size * 0.12,
      }}
    />
  );
}

// A little "target" (goal) glyph drawn from a ring + dot.
function TargetIcon() {
  return (
    <View style={m.targetRing}>
      <View style={m.targetDot} />
    </View>
  );
}

// Scattered decorative dots, like the prototype's welcome/done backgrounds.
function DecorDots() {
  return (
    <>
      <View style={[m.decorDot, { top: 70, left: 42, backgroundColor: '#C9C3F0' }]} />
      <View style={[m.decorDot, { top: 150, right: 46, backgroundColor: '#8FE0BE' }]} />
      <View style={[m.decorDot, { bottom: 120, left: 34, backgroundColor: '#F5B73C' }]} />
    </>
  );
}

function WelcomeCard({ t }: { t: TFunction }) {
  return (
    <View style={m.welcomeCard}>
      <View style={m.welcomeBadge}>
        <Check size={12} thickness={2.5} color="#fff" />
      </View>
      <View style={m.welcomeCardRow}>
        <View style={m.welcomeIconBox}>
          <TargetIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={m.welcomeCardTitle}>{t('tour.mock.goalRun')}</Text>
          <Text style={m.welcomeStreak}>7 {t('goalDetail.streakLabel')}</Text>
        </View>
      </View>
      <Text style={m.welcomeStars}>★★★★★</Text>
      <Text style={m.welcomeQuote}>«{t('tour.mock.entry')}»</Text>
    </View>
  );
}

function NavBarMock({ active }: { active: 'home' | 'overview' | 'profile' }) {
  const icon = (shape: NavShape, key: 'home' | 'overview' | 'profile') => {
    const on = active === key;
    return (
      <View key={key} style={[m.navIcon, on && m.navIconActive]}>
        <NavIcon shape={shape} color={on ? '#7F77DD' : '#B4B2A9'} />
      </View>
    );
  };
  return (
    <View style={m.navBar}>
      {icon('home', 'home')}
      {icon('bars', 'overview')}
      {icon('person', 'profile')}
    </View>
  );
}

function TodayHeaderMock({ t }: { t: TFunction }) {
  return (
    <>
      <Text style={m.dateLabel}>{todayLabel()}</Text>
      <Text style={m.screenTitle}>{t('today.title')}</Text>
    </>
  );
}

function renderMock(step: number, t: TFunction): ReactNode {
  switch (STEPS[step]) {
    case 'welcome':
      return (
        <View style={m.welcomeWrap}>
          <DecorDots />
          <WelcomeCard t={t} />
          <View>
            <Text style={m.brand}>Litopys</Text>
            <Text style={m.tagline}>{t('tour.welcomeTagline')}</Text>
          </View>
        </View>
      );

    case 'newGoal':
      return (
        <View style={m.screen}>
          <TodayHeaderMock t={t} />
          <View style={m.stack}>
            <Dim><GoalCardMock title={t('tour.mock.goalRun')} sub={t('today.entriesToday', { count: 2 })} subColor="#4CAF88" trailing={<PlusCircle />} /></Dim>
            <Dim><GoalCardMock title={t('tour.mock.goalRead')} sub={t('today.noEntryToday')} subColor="#B4B2A9" trailing={<PlusCircle />} /></Dim>
          </View>
          <View style={[m.newGoalBtn, m.highlight]}>
            <Text style={m.newGoalText}>＋ {t('today.newGoal')}</Text>
          </View>
        </View>
      );

    case 'record':
      return (
        <View style={m.screen}>
          <TodayHeaderMock t={t} />
          <Text style={m.sectionLabel}>{t('today.tapToRecord')}</Text>
          <View style={m.stack}>
            <GoalCardMock highlight title={t('tour.mock.goalRun')} sub={t('today.entriesToday', { count: 2 })} subColor="#4CAF88" trailing={<PlusCircle filled />} />
            <Dim><GoalCardMock title={t('tour.mock.goalRead')} sub={t('today.noEntryToday')} subColor="#B4B2A9" trailing={<PlusCircle />} /></Dim>
          </View>
        </View>
      );

    case 'manage':
      return (
        <View style={m.screen}>
          <TodayHeaderMock t={t} />
          <View style={m.stack}>
            <Dim><GoalCardMock title={t('tour.mock.goalRun')} sub={t('today.entriesToday', { count: 2 })} subColor="#4CAF88" trailing={<PlusCircle />} /></Dim>
            <Dim><GoalCardMock title={t('tour.mock.goalRead')} sub={t('today.noEntryToday')} subColor="#B4B2A9" trailing={<PlusCircle />} /></Dim>
          </View>
          <View style={[m.manageBtn, m.highlight]}>
            <Text style={m.manageText}>{t('today.manageGoals')}</Text>
          </View>
        </View>
      );

    case 'history':
      return (
        <View style={m.screen}>
          <Text style={m.backLabel}>◂ {t('goals.title')}</Text>
          <Text style={m.goalTitle}>{t('tour.mock.goalRun')}</Text>
          <View style={m.statsRow}>
            <View><Text style={m.statValue}>18</Text><Text style={m.statLabel}>{t('goalDetail.entriesLabel')}</Text></View>
            <View><Text style={m.statValue}>4.1</Text><Text style={m.statLabel}>{t('goalDetail.avgLabel')}</Text></View>
            <View><Text style={m.statValue}>7</Text><Text style={m.statLabel}>{t('goalDetail.streakLabel')}</Text></View>
          </View>
          <Text style={m.sectionLabel}>{t('goalDetail.historyLabel')}</Text>
          <View style={[m.timelineCard, m.highlight]}>
            <View style={m.timelineRow}>
              <View style={m.dot} />
              <View style={{ flex: 1 }}>
                <Text style={m.timelineWhen}>{t('deadline.today')}</Text>
                <View style={m.entryCard}>
                  <Text style={m.entryStars}>★★★★★</Text>
                  <Text style={m.entryText}>{t('tour.mock.entry')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );

    case 'overview':
      return (
        <View style={m.screen}>
          <Dim>
            <Text style={m.screenTitle}>{t('overview.title')}</Text>
            <Text style={m.subtitle}>{t('overview.subtitle')}</Text>
            <LinearGradient colors={['#534AB7', '#7F77DD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.hero}>
              <Text style={m.heroPeriod}>{t('tour.mock.ovPeriod')}</Text>
              <Text style={m.heroHeadline}>{t('tour.mock.ovHeadline')}</Text>
              <Text style={m.heroBody}>{t('tour.mock.ovBody')}</Text>
            </LinearGradient>
          </Dim>
          <View style={m.navWrap}>
            <NavBarMock active="overview" />
          </View>
        </View>
      );

    case 'done':
      return (
        <View style={m.doneWrap}>
          <DecorDots />
          <LinearGradient colors={['#5CBE93', '#3E9E76']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={m.doneCircle}>
            <Check size={40} thickness={5} color="#fff" />
          </LinearGradient>
          <Text style={m.doneHeadline}>{t('tour.doneHeadline')}</Text>
          <Text style={m.doneSub}>{t('tour.doneSub')}</Text>
        </View>
      );
  }
}

export default function TourScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const syncMeta = useSyncMeta();
  const [step, setStep] = useState(0);

  const isFirst = step === 0;
  const isLast = step === LAST;
  const key = STEPS[step];

  async function finish() {
    await syncMeta.setTourCompleted();
    router.back();
  }

  function next() {
    if (isLast) finish();
    else setStep(s => s + 1);
  }

  function back() {
    setStep(s => Math.max(0, s - 1));
  }

  return (
    <View style={s.container}>
      <View style={[s.body, { paddingTop: insets.top }]}>{renderMock(step, t)}</View>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <View style={s.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        <Text style={s.title}>{t(`tour.steps.${key}.title`)}</Text>
        <Text style={s.desc}>{t(`tour.steps.${key}.desc`)}</Text>

        <View style={s.actions}>
          {!isFirst && !isLast && (
            <Pressable style={s.backBtn} onPress={back} hitSlop={8}>
              <Text style={s.backBtnText}>←</Text>
            </Pressable>
          )}
          <Pressable style={s.nextBtn} onPress={next}>
            <Text style={s.nextBtnText}>
              {isFirst ? t('tour.start') : isLast ? t('tour.finish') : t('tour.next')}
            </Text>
          </Pressable>
        </View>

        {!isFirst && !isLast && (
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={s.skip}>{t('tour.skip')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  body: { flex: 1, overflow: 'hidden' },

  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EFEDE7', padding: 22, paddingBottom: 28 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot: { width: 20, height: 4, borderRadius: 3, backgroundColor: '#D8D5E8' },
  dotActive: { backgroundColor: '#7F77DD' },

  title: { fontSize: 17, fontWeight: '800', color: '#26215C' },
  desc: { fontSize: 12.5, color: '#928F87', marginTop: 5, lineHeight: 19 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  backBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(127,119,221,0.12)' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#7F77DD' },
  nextBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#7F77DD', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
  nextBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },

  skip: { textAlign: 'center', marginTop: 12, fontSize: 11.5, fontWeight: '600', color: '#B4B2A9' },
});

const m = StyleSheet.create({
  // welcome slide
  welcomeWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 44 },
  welcomeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginHorizontal: 8, shadowColor: '#26215C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  welcomeBadge: { position: 'absolute', top: -10, right: -6, width: 34, height: 34, borderRadius: 17, backgroundColor: '#4CAF88', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F5F4F0' },
  welcomeCardRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  welcomeIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  welcomeCardTitle: { fontSize: 15, fontWeight: '800', color: '#26215C' },
  welcomeStreak: { fontSize: 12, fontWeight: '700', color: '#F5B73C', marginTop: 3 },
  welcomeStars: { fontSize: 13, color: '#F5B73C', marginTop: 12, letterSpacing: 1 },
  welcomeQuote: { fontSize: 12.5, color: '#6B6A66', marginTop: 6, lineHeight: 18 },
  brand: { fontSize: 40, fontWeight: '800', color: '#26215C', textAlign: 'center', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: '#928F87', textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 24 },
  targetRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#7F77DD', alignItems: 'center', justifyContent: 'center' },
  targetDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7F77DD' },
  decorDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },

  // done slide
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 14 },
  doneCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: '#3E9E76', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  doneHeadline: { fontSize: 26, fontWeight: '800', color: '#26215C', marginTop: 6 },
  doneSub: { fontSize: 14, color: '#928F87', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  screen: { flex: 1, paddingHorizontal: 22, paddingTop: 22 },
  dateLabel: { fontSize: 12, fontWeight: '600', color: '#A8A69E' },
  screenTitle: { fontSize: 25, fontWeight: '800', color: '#26215C', letterSpacing: -0.4, marginTop: 2 },
  subtitle: { fontSize: 12, color: '#928F87', marginTop: 3 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#B4B2A9', marginTop: 18, marginBottom: 11 },
  stack: { gap: 11, marginTop: 16 },

  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardTextCol: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2A' },
  cardSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  highlight: { borderWidth: 2, borderColor: '#7F77DD', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },

  plus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  plusHollow: { backgroundColor: '#EEEDFE' },
  plusFilled: { backgroundColor: '#7F77DD' },
  plusText: { fontSize: 16, lineHeight: 18 },

  newGoalBtn: { borderWidth: 1.5, borderColor: '#7F77DD', borderStyle: 'dashed', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 12, backgroundColor: '#fff' },
  newGoalText: { fontSize: 13, fontWeight: '700', color: '#7F77DD' },

  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, marginTop: 16 },
  manageText: { fontSize: 13, fontWeight: '700', color: '#7F77DD' },

  backLabel: { fontSize: 12.5, fontWeight: '600', color: '#928F87' },
  goalTitle: { fontSize: 22, fontWeight: '800', color: '#26215C', letterSpacing: -0.3, marginTop: 5 },
  statsRow: { flexDirection: 'row', gap: 18, marginTop: 12 },
  statValue: { fontSize: 19, fontWeight: '800', color: '#7F77DD' },
  statLabel: { fontSize: 10, fontWeight: '500', color: '#928F87', marginTop: 2 },
  timelineCard: { borderRadius: 16, padding: 12, backgroundColor: '#fff' },
  timelineRow: { flexDirection: 'row', gap: 12 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#7F77DD', marginTop: 3 },
  timelineWhen: { fontSize: 12, fontWeight: '700', color: '#2C2C2A' },
  entryCard: { backgroundColor: '#F8F7F3', borderRadius: 13, padding: 10, marginTop: 5 },
  entryStars: { fontSize: 10, fontWeight: '700', color: '#F5B73C' },
  entryText: { fontSize: 11.5, color: '#2C2C2A', marginTop: 3, lineHeight: 16 },

  hero: { borderRadius: 20, padding: 16, marginTop: 16 },
  heroPeriod: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  heroHeadline: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 6 },
  heroBody: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 6, lineHeight: 18 },
  navWrap: { marginTop: 'auto' },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EFEDE7', paddingVertical: 10, marginHorizontal: -22 },
  navIcon: { paddingHorizontal: 17, paddingVertical: 6, borderRadius: 14 },
  navIconActive: { backgroundColor: '#EEEDFE' },
});
