import { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Goal, Entry } from '@/db/types';
import { computeStreak } from '@/utils/streak';
import { fromIsoDate, toIsoDate, todayIso } from '@/utils/date';
import { isEntryEditable, weekEnd } from '@/utils/entryWindow';

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDate(d);
}

function formatWhen(dateNote: string, t: TFunction, locale: string): string {
  if (dateNote === todayIso()) return t('deadline.today');
  if (dateNote === isoDaysAgo(1)) return t('goalDetail.yesterday');
  // fromIsoDate, not new Date(dateNote): the latter parses a bare YYYY-MM-DD
  // as UTC midnight, which renders as the previous day west of UTC.
  return fromIsoDate(dateNote).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

/** True once an entry has been changed since it was written. */
function wasEdited(e: Entry): boolean {
  return !!e.updated_at && !!e.created_at && e.updated_at !== e.created_at;
}

// Stats + history timeline for a single goal. Presentational: the caller owns
// data-loading and wraps this in a scroll container. Shared by the goal detail
// screen (goal/[id]) and the tablet master-detail panel so both render
// identically. `action` fills the top-right slot (Edit button, add-entry, ...).
//
// Per-entry edit/delete controls appear only while the entry's week is still
// open (see utils/entryWindow) and only when the caller passes handlers — the
// server enforces the same window, so showing them later would just produce a
// 403 the user cannot act on.
export function GoalDetailView({
  goal,
  history,
  action,
  onEditEntry,
  onDeleteEntry,
}: {
  goal: Goal;
  history: Entry[];
  action?: ReactNode;
  onEditEntry?: (entry: Entry) => void;
  onDeleteEntry?: (entry: Entry) => void;
}) {
  const { t, i18n } = useTranslation();
  const count = history.length;
  const avg = count > 0
    ? (history.reduce((sum, e) => sum + e.productivity_score, 0) / count).toFixed(1)
    : '—';
  const streak = computeStreak(history.map(e => e.date_note));
  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';

  return (
    <>
      <View style={s.topRow}>
        <Text style={s.title} numberOfLines={2}>{goal.title}</Text>
        {action}
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{count}</Text>
          <Text style={s.statLabel}>{t('goalDetail.entriesLabel')}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{avg}</Text>
          <Text style={s.statLabel}>{t('goalDetail.avgLabel')}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{streak}</Text>
          <Text style={s.statLabel}>{t('goalDetail.streakLabel')}</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>{t('goalDetail.historyLabel')}</Text>

      {history.length === 0 ? (
        <Text style={s.empty}>{t('goalDetail.emptyHistory')}</Text>
      ) : (
        <View style={s.timeline}>
          {history.map((e, i) => {
            const editable = isEntryEditable(e) && !!(onEditEntry || onDeleteEntry);
            return (
              <View key={e.id} style={s.timelineRow}>
                <View style={s.timelineDotCol}>
                  <View style={[s.dot, i === 0 && s.dotFirst]} />
                  {i < history.length - 1 && <View style={s.timelineLine} />}
                </View>
                <View style={s.timelineBody}>
                  <View style={s.timelineHeader}>
                    <Text style={s.timelineWhen}>{formatWhen(e.date_note, t, locale)}</Text>
                    {wasEdited(e) && <Text style={s.editedTag}>{t('entry.edited')}</Text>}
                  </View>
                  <View style={s.timelineCard}>
                    <Text style={s.timelineStars}>{'★'.repeat(e.productivity_score)}</Text>
                    <Text style={s.timelineText}>{e.note}</Text>

                    {editable && (
                      <View style={s.entryActions}>
                        {onEditEntry && (
                          <Pressable onPress={() => onEditEntry(e)} hitSlop={8}>
                            <Text style={s.entryAction}>{t('entry.edit')}</Text>
                          </Pressable>
                        )}
                        {onDeleteEntry && (
                          <Pressable onPress={() => onDeleteEntry(e)} hitSlop={8}>
                            <Text style={[s.entryAction, s.entryActionDanger]}>
                              {t('entry.delete')}
                            </Text>
                          </Pressable>
                        )}
                        <Text style={s.entryDeadline}>
                          {t('entry.editableUntil', {
                            date: fromIsoDate(weekEnd(e.date_note)).toLocaleDateString(locale, {
                              day: 'numeric',
                              month: 'long',
                            }),
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontSize: 23, fontWeight: '800', color: '#26215C', letterSpacing: -0.3 },

  statsRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  stat: {},
  statValue: { fontSize: 20, fontWeight: '800', color: '#7F77DD' },
  statLabel: { fontSize: 10.5, fontWeight: '500', color: '#928F87', marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#B4B2A9', marginTop: 22, marginBottom: 14 },

  timeline: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineDotCol: { alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#C9C3F0' },
  dotFirst: { backgroundColor: '#7F77DD' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E7E4DD', marginTop: 2 },
  timelineBody: { flex: 1, paddingBottom: 15 },
  timelineHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  timelineWhen: { fontSize: 12, fontWeight: '700', color: '#2C2C2A' },
  editedTag: { fontSize: 10, fontWeight: '600', color: '#B4B2A9' },
  timelineCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginTop: 6, shadowColor: '#26215C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  timelineStars: { fontSize: 10.5, fontWeight: '700', color: '#F5B73C' },
  timelineText: { fontSize: 12, color: '#2C2C2A', marginTop: 4, lineHeight: 17 },

  entryActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0EEE8' },
  entryAction: { fontSize: 11.5, fontWeight: '700', color: '#7F77DD' },
  entryActionDanger: { color: '#993C1D' },
  entryDeadline: { flex: 1, textAlign: 'right', fontSize: 10, color: '#B4B2A9' },

  empty: { textAlign: 'center', marginTop: 30, fontSize: 14, color: '#B4B2A9' },
});
