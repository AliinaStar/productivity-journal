import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';

export default function AddEntryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const entries = useEntries();

  const [goalTitle, setGoalTitle] = useState('');
  const [note, setNote] = useState('');
  const [score, setScore] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    goals.getById(id).then(g => { if (g) setGoalTitle(g.title); });
  }, [id]);

  async function handleSave() {
    if (!note.trim()) { setError(t('entry.errorEmpty')); return; }
    setSaving(true);
    setError(null);
    try {
      await entries.create({
        goalId: id,
        dateNote: new Date().toISOString().split('T')[0],
        note: note.trim(),
        productivityScore: score,
      });
      router.back();
    } catch {
      setError(t('entry.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.goalName}>{goalTitle}</Text>

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
          <TouchableOpacity key={n} onPress={() => setScore(n)} activeOpacity={0.7}>
            <Text style={[s.star, n <= score && s.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('entry.save')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F4F0' },
  goalName: { fontSize: 20, fontWeight: '600', color: '#26215C', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, color: '#2C2C2A', height: 140, textAlignVertical: 'top', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 34, color: '#DEDBD5' },
  starActive: { color: '#F5B73C' },
  error: { fontSize: 13, color: '#993C1D', marginTop: 8 },
  saveBtn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
