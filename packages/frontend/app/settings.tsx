import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/api-client/client';
import { APP_LANGUAGES, APP_LANGUAGE_LABELS, AppLanguage, setAppLanguage } from '@/utils/locale';

const GENDER_KEYS = ['female', 'male', 'unspecified'] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('unspecified');
  const [birthYear, setBirthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/users/me');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setName(data.name ?? '');
        setGender(data.gender ?? 'unspecified');
        setBirthYear(data.birth_year != null ? String(data.birth_year) : '');
      } catch {
        setError(t('settings.errorLoad'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!name.trim()) { setError(t('settings.errorName')); return; }
    // Optional. Empty -> null (backend leaves the column untouched). If filled,
    // it must be a plausible year; the same bound is re-checked server-side.
    let birthYearValue: number | null = null;
    if (birthYear.trim()) {
      const n = Number(birthYear.trim());
      if (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear()) {
        setError(t('settings.errorBirthYear'));
        return;
      }
      birthYearValue = n;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), gender, birth_year: birthYearValue }),
      });
      if (!res.ok) throw new Error();
      router.back();
    } catch {
      setError(t('settings.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#7F77DD" /></View>;
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{t('settings.title')}</Text>

      <Text style={s.label}>{t('settings.nameLabel')}</Text>
      <TextInput style={s.input} placeholder={t('settings.namePlaceholder')} placeholderTextColor="#B4B2A9" value={name} onChangeText={setName} autoCapitalize="words" />

      <Text style={s.label}>{t('settings.appLanguageLabel')}</Text>
      <View style={s.chips}>
        {APP_LANGUAGES.map(lng => (
          <TouchableOpacity key={lng} style={[s.chip, i18n.language === lng && s.chipSelected]} onPress={() => setAppLanguage(lng as AppLanguage)} activeOpacity={0.7}>
            <Text style={[s.chipText, i18n.language === lng && s.chipTextSelected]}>{APP_LANGUAGE_LABELS[lng]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{t('settings.genderLabel')}</Text>
      <View style={s.chips}>
        {GENDER_KEYS.map(key => (
          <TouchableOpacity key={key} style={[s.chip, gender === key && s.chipSelected]} onPress={() => setGender(key)} activeOpacity={0.7}>
            <Text style={[s.chipText, gender === key && s.chipTextSelected]}>{t(`onboarding.genders.${key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{t('settings.birthYearLabel')}</Text>
      <TextInput style={s.input} placeholder={t('settings.birthYearPlaceholder')} placeholderTextColor="#B4B2A9" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" maxLength={4} />

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.btn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('settings.save')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={s.cancelText}>{t('settings.cancel')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 24, paddingTop: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },
  title: { fontSize: 24, fontWeight: '700', color: '#26215C', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 24, color: '#2C2C2A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E4DF' },
  chipSelected: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  chipText: { fontSize: 13, color: '#5F5E5A', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  error: { fontSize: 13, color: '#993C1D', marginBottom: 12 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelText: { fontSize: 14, color: '#888780' },
});
