import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSyncMeta } from '@/db/sync';
import { useSync } from '@/hooks/useSync';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const IS_DEV = process.env.EXPO_PUBLIC_APP_ENV === 'development';

export default function LoginScreen() {
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
      setError('Не вдалося надіслати код. Перевір email або з\'єднання.');
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
      setError('Невірний або прострочений код.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>productivity journal</Text>

      {step === 'email' ? (
        <>
          <Text style={s.sub}>введи email щоб отримати код</Text>
          <TextInput
            style={s.input}
            placeholder="email@example.com"
            placeholderTextColor="#B4B2A9"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {error && <Text style={s.error}>{error}</Text>}
          <TouchableOpacity style={s.btn} onPress={handleSendCode} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Надіслати код</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={s.sub}>введи 6-значний код з листа на {email}</Text>
          <TextInput
            style={[s.input, s.codeInput]}
            placeholder="000000"
            placeholderTextColor="#B4B2A9"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          {error && <Text style={s.error}>{error}</Text>}
          <TouchableOpacity style={s.btn} onPress={handleVerifyCode} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Увійти</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('email'); setError(null); setCode(''); }} style={s.back}>
            <Text style={s.backText}>← змінити email</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#F5F4F0' },
  title: { fontSize: 28, fontWeight: '600', color: '#26215C', marginBottom: 6 },
  sub: { fontSize: 14, color: '#888780', marginBottom: 28 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: '#2C2C2A' },
  codeInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
  error: { fontSize: 13, color: '#993C1D', marginBottom: 12 },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  back: { marginTop: 16, alignItems: 'center' },
  backText: { fontSize: 13, color: '#7F77DD' },
});
