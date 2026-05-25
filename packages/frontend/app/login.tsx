import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSyncMeta } from '@/db/sync';
import { useSync } from '@/hooks/useSync';
import { BASE_URL } from '@/api-client/config';

const IS_DEV = process.env.EXPO_PUBLIC_APP_ENV === 'development';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncMeta = useSyncMeta();
  const { pullGoals, pullEntries, clearLocalData } = useSync();

  async function handleSendCode() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (IS_DEV) {
        const res = await fetch(`${BASE_URL}/auth/dev-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) throw new Error();
        await afterLogin(await res.json());
        return;
      }
      const res = await fetch(`${BASE_URL}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setStep('code');
    } catch {
      setError(t('login.errorSend'));
    } finally {
      setLoading(false);
    }
  }

  async function afterLogin(data: { user_id: number; is_new: boolean }) {
    await syncMeta.setUserRemoteId(data.user_id);
    try { await clearLocalData(); } catch {}
    if (data.is_new) {
      router.replace('/onboarding');
    } else {
      try { await pullGoals(); await pullEntries(); } catch {}
      router.replace('/(tabs)');
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) throw new Error();
      await afterLogin(await res.json());
    } catch {
      setError(t('login.errorCode'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#534AB7', '#7F77DD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.top}>
        <Text style={s.appName}>{t('login.appName')}</Text>
        <Text style={s.tagline}>{t('login.tagline')}</Text>
      </LinearGradient>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('login.cardTitle')}</Text>

        {step === 'email' ? (
          <>
            <Text style={s.cardSub}>{t('login.emailSub')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor="#B4B2A9"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity style={s.btn} onPress={handleSendCode} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('login.sendCode')}</Text>}
            </TouchableOpacity>
            <Text style={s.hint}>{t('login.noAccount')}</Text>
          </>
        ) : (
          <>
            <Text style={s.cardSub}>{t('login.codeSub', { email })}</Text>
            <TextInput
              style={[s.input, s.codeInput]}
              placeholder={t('login.codePlaceholder')}
              placeholderTextColor="#B4B2A9"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            {error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity style={s.btn} onPress={handleVerifyCode} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('login.signIn')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('email'); setError(null); setCode(''); }} style={s.back}>
              <Text style={s.backText}>{t('login.changeEmail')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0' },
  top: { paddingTop: 80, paddingBottom: 80, paddingHorizontal: 28 },
  appName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  tagline: { fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 },
  card: {
    marginTop: -32,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#534AB7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#26215C', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#888780', marginBottom: 20, lineHeight: 18 },
  input: { backgroundColor: '#F5F4F0', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: '#2C2C2A' },
  codeInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
  error: { fontSize: 13, color: '#993C1D', marginBottom: 12 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', shadowColor: '#7F77DD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { textAlign: 'center', marginTop: 14, fontSize: 11, color: '#B4B2A9' },
  back: { marginTop: 16, alignItems: 'center' },
  backText: { fontSize: 13, color: '#7F77DD' },
});
