import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGoals } from '@/db/goals';
import { Goal } from '@/db/types';
import { BottomSheet } from './bottom-sheet';

/** Bottom sheet for quickly creating a goal (title only — full editing stays in goal/edit). */
export function NewGoalSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (goal: Goal) => void;
}) {
  const { t } = useTranslation();
  const goals = useGoals();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the sheet is opened.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setError(null);
    }
  }, [visible]);

  async function handleSave() {
    if (!title.trim()) { setError(t('goal.errorTitle')); return; }
    setSaving(true);
    setError(null);
    try {
      const goal = await goals.create({ title: title.trim() });
      onSaved(goal);
    } catch {
      setError(t('goal.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={s.title}>{t('goal.newTitle')}</Text>
        <Text style={s.subtitle}>{t('goal.newSubtitle')}</Text>

        <Text style={s.label}>{t('goal.titleLabel')}</Text>
        <TextInput
          style={s.input}
          placeholder={t('goal.titlePlaceholder')}
          placeholderTextColor="#B4B2A9"
          value={title}
          onChangeText={setTitle}
          multiline
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.actions}>
          <Pressable style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>{t('goal.cancel')}</Text>
          </Pressable>
          <Pressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('goal.create')}</Text>}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: '#26215C' },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#928F87', marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#B4B2A9', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E7E4DD', borderRadius: 14, padding: 12, height: 52, fontSize: 14, fontWeight: '500', color: '#2C2C2A', textAlignVertical: 'top' },
  error: { fontSize: 12, color: '#993C1D', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: '#EEECE6' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#7A776E' },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#7F77DD', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
