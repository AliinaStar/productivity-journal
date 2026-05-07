import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSyncMeta } from '@/db/sync';
import { useSync } from '@/hooks/useSync';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const LANGUAGES = ['English', 'Ukrainian', 'Polish', 'German', 'French', 'Spanish'];
const GENDERS: { value: string; label: string }[] = [
  { value: 'female',      label: 'Жінка' },
  { value: 'male',        label: 'Чоловік' },
  { value: 'unspecified', label: 'Не вказувати' },
];

export default function OnboardingScreen() {
  const syncMeta = useSyncMeta();
  const { pullGoals, pullEntries } = useSync();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('Ukrainian');
  const [gender, setGender] = useState('unspecified');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Введи своє ім'я");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userId = await syncMeta.getUserRemoteId();
      const res = await fetch(`${BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
        body: JSON.stringify({ name: name.trim(), language, gender }),
      });
      if (!res.ok) throw new Error();
      try { await pullGoals(); await pullEntries(); } catch {}
      router.replace('/(tabs)');
    } catch {
      setError('Не вдалося зберегти. Спробуй ще раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Розкажи про себе</Text>
      <Text style={s.sub}>Це допоможе нам персоналізувати звіти</Text>

      <Text style={s.label}>Як тебе звати?</Text>
      <TextInput
        style={s.input}
        placeholder="Ім'я"
        placeholderTextColor="#B4B2A9"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={s.label}>Мова звітів</Text>
      <View style={s.chips}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang}
            style={[s.chip, language === lang && s.chipSelected]}
            onPress={() => setLanguage(lang)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, language === lang && s.chipTextSelected]}>{lang}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Стать</Text>
      <View style={s.chips}>
        {GENDERS.map(g => (
          <TouchableOpacity
            key={g.value}
            style={[s.chip, gender === g.value && s.chipSelected]}
            onPress={() => setGender(g.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, gender === g.value && s.chipTextSelected]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.btn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Продовжити</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 28, paddingTop: 64 },
  title: { fontSize: 26, fontWeight: '700', color: '#26215C', marginBottom: 6 },
  sub: { fontSize: 14, color: '#888780', marginBottom: 36 },

  label: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 28, color: '#2C2C2A' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E4DF' },
  chipSelected: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },

  error: { fontSize: 13, color: '#993C1D', marginBottom: 12 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
