import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/api-client/client';

export default function FeedbackScreen() {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await apiFetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error();
      Alert.alert(t('feedback.sentTitle'), t('feedback.sentBody'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('feedback.errorTitle'), t('feedback.errorBody'));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>{t('feedback.intro')}</Text>

        <TextInput
          style={s.input}
          placeholder={t('feedback.placeholder')}
          placeholderTextColor="#B4B2A9"
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          maxLength={2000}
          autoFocus
        />

        <TouchableOpacity
          style={[s.btn, !message.trim() && s.btnDisabled]}
          onPress={handleSend}
          disabled={sending || !message.trim()}
          activeOpacity={0.8}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('feedback.send')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F4F0' },
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 24 },
  intro: { fontSize: 14, color: '#5F5E5A', lineHeight: 20, marginBottom: 20 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#2C2C2A',
    minHeight: 160,
    marginBottom: 20,
  },
  btn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
