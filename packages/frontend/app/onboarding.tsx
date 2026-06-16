import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/useSync';
import { apiFetch } from '@/api-client/client';
import { APP_LANGUAGES, APP_LANGUAGE_LABELS, AppLanguage, setAppLanguage } from '@/utils/locale';
import { REPORT_LANGUAGES } from '@/utils/reportLanguages';
import { LanguageSelect } from '@/components/language-select';

const GENDER_KEYS = ['female', 'male', 'unspecified'] as const;

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { pullGoals, pullEntries } = useSync();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('Ukrainian');
  const [gender, setGender] = useState('unspecified');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError(t('onboarding.errorName')); return; }
    if (!consent) { setError(t('onboarding.consentRequired')); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), language, gender }),
      });
      if (!res.ok) throw new Error();
      await apiFetch('/users/me/consent', { method: 'POST' });
      try { await pullGoals(); await pullEntries(); } catch {}
      router.replace('/(tabs)');
    } catch {
      setError(t('onboarding.errorSave'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{t('onboarding.title')}</Text>
      <Text style={s.sub}>{t('onboarding.sub')}</Text>

      <Text style={s.label}>{t('onboarding.nameLabel')}</Text>
      <TextInput
        style={s.input}
        placeholder={t('onboarding.namePlaceholder')}
        placeholderTextColor="#B4B2A9"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={s.label}>{t('onboarding.appLanguageLabel')}</Text>
      <View style={s.chips}>
        {APP_LANGUAGES.map(lng => (
          <TouchableOpacity key={lng} style={[s.chip, i18n.language === lng && s.chipSelected]} onPress={() => setAppLanguage(lng as AppLanguage)} activeOpacity={0.7}>
            <Text style={[s.chipText, i18n.language === lng && s.chipTextSelected]}>{APP_LANGUAGE_LABELS[lng]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{t('onboarding.languageLabel')}</Text>
      <LanguageSelect value={language} options={REPORT_LANGUAGES} onChange={setLanguage} />

      <Text style={s.label}>{t('onboarding.genderLabel')}</Text>
      <View style={s.chips}>
        {GENDER_KEYS.map(key => (
          <TouchableOpacity key={key} style={[s.chip, gender === key && s.chipSelected]} onPress={() => setGender(key)} activeOpacity={0.7}>
            <Text style={[s.chipText, gender === key && s.chipTextSelected]}>{t(`onboarding.genders.${key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.consentRow} onPress={() => setConsent(c => !c)} activeOpacity={0.7}>
        <View style={[s.checkbox, consent && s.checkboxOn]}>
          {consent && <Text style={s.checkboxTick}>✓</Text>}
        </View>
        <Text style={s.consentText}>{t('onboarding.consent')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.7}>
        <Text style={s.policyLink}>{t('onboarding.viewPolicy')}</Text>
      </TouchableOpacity>

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.btn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('onboarding.continue')}</Text>}
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
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#B4B2A9', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '700' },
  consentText: { flex: 1, fontSize: 13, color: '#5F5E5A', lineHeight: 18 },
  policyLink: { fontSize: 13, color: '#7F77DD', marginTop: 10, marginLeft: 32 },
});
