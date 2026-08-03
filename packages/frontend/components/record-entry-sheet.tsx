import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEntries } from '@/db/entries';
import { Entry, Goal } from '@/db/types';
import { todayIso } from '@/utils/date';
import { BottomSheet } from './bottom-sheet';

const DEFAULT_SCORE = 3;

/**
 * Bottom sheet for writing a progress entry against a goal.
 *
 * Doubles as the edit form: pass `entry` to load an existing note instead of
 * starting a blank one. Editing reuses this sheet rather than a screen of its
 * own so the two never drift apart in validation or layout — an edited entry
 * has to obey exactly the rules a new one does.
 */
export function RecordEntrySheet({
  goal,
  entry = null,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  entry?: Entry | null;
  onClose: () => void;
  onSaved: (goalId: string) => void;
}) {
  const { t } = useTranslation();
  const entries = useEntries();
  const [note, setNote] = useState('');
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the sheet is opened — blank for a new entry,
  // prefilled with the existing one when editing.
  useEffect(() => {
    if (goal) {
      setNote(entry?.note ?? '');
      setScore(entry?.productivity_score ?? DEFAULT_SCORE);
      setError(null);
    }
  }, [goal?.id, entry?.id]);

  async function handleSave() {
    if (!goal) return;
    if (!note.trim()) { setError(t('entry.errorEmpty')); return; }
    setSaving(true);
    setError(null);
    try {
      if (entry) {
        // date_note is left alone: moving an entry between weeks is what the
        // edit window exists to prevent, and the server rejects it anyway.
        await entries.update(entry.id, {
          note: note.trim(),
          productivity_score: score,
        });
      } else {
        await entries.create({
          goalId: goal.id,
          // The device's own calendar day, not the UTC one: a note written at
          // 01:00 in Kyiv belongs to that day, not to yesterday. This is also
          // the week whose report will quote it and how long it stays editable.
          dateNote: todayIso(),
          note: note.trim(),
          productivityScore: score,
        });
      }
      onSaved(goal.id);
    } catch {
      setError(t('entry.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={!!goal} onClose={onClose}>
      {goal && (
        <View>
          <Text style={s.title}>{entry ? t('entry.editTitle') : t('entry.new')}</Text>
          <Text style={s.subtitle}>{goal.title}</Text>

          <Text style={s.label}>{t('entry.noteLabel')}</Text>
          <TextInput
            style={s.input}
            placeholder={t('entry.notePlaceholder')}
            placeholderTextColor="#B4B2A9"
            value={note}
            onChangeText={setNote}
            multiline
          />

          <Text style={s.label}>{t('entry.scoreLabel')}</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setScore(n)} hitSlop={6}>
                <Text style={[s.star, n <= score && s.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>{t('entry.cancel')}</Text>
            </Pressable>
            <Pressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('entry.save')}</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: '#26215C' },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#928F87', marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#B4B2A9', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E7E4DD', borderRadius: 14, padding: 12, height: 88, fontSize: 14, color: '#2C2C2A', textAlignVertical: 'top' },
  stars: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 34, lineHeight: 38, color: '#DED9CF' },
  starActive: { color: '#F5B73C' },
  error: { fontSize: 12, color: '#993C1D', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: '#EEECE6' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#7A776E' },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#7F77DD', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
