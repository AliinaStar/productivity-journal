import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSyncMeta } from '@/db/sync';
import { useEntries } from '@/db/entries';
import { useSync } from '@/hooks/useSync';
import { apiFetch, logout } from '@/api-client/client';
import {
  DEFAULT_REMINDER_TIME,
  ReminderTime,
  getReminderTime,
  setReminderTime,
  unregisterPushToken,
} from '@/utils/notifications';
import { computeStreak } from '@/utils/streak';
import { REPORT_LANGUAGES } from '@/utils/reportLanguages';
import { LanguagePickerModal } from '@/components/language-select';

interface Stats {
  count: number;
  avg: number | null;
  streak: number;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const syncMeta = useSyncMeta();
  const entriesDb = useEntries();
  const { clearLocalData } = useSync();
  const [profile, setProfile] = useState<{ name: string; email: string; language: string } | null>(null);
  const [stats, setStats] = useState<Stats>({ count: 0, avg: null, streak: 0 });
  const [busy, setBusy] = useState(false);
  const [reminder, setReminder] = useState<ReminderTime>(DEFAULT_REMINDER_TIME);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    loadProfile();
    loadStats();
    getReminderTime().then(setReminder);
  }, []));

  async function loadProfile() {
    try {
      const res = await apiFetch('/users/me');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile({ name: data.name ?? '', email: data.email ?? '', language: data.language ?? '' });
    } catch {
      // Offline or expired session — keep whatever is already on screen
      // instead of replacing real data with a placeholder.
    }
  }

  async function loadStats() {
    const all = await entriesDb.getAll();
    const count = all.length;
    const avg = count > 0 ? all.reduce((sum, e) => sum + e.productivity_score, 0) / count : null;
    setStats({ count, avg, streak: computeStreak(all.map(e => e.date_note)) });
  }

  async function saveReportLanguage(language: string) {
    setLangPickerOpen(false);
    const prev = profile;
    // Optimistically reflect the choice; roll back if the server rejects it.
    setProfile(p => (p ? { ...p, language } : p));
    try {
      const res = await apiFetch('/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProfile(prev);
    }
  }

  function onReminderChange(event: DateTimePickerEvent, selected?: Date) {
    setShowTimePicker(false);
    if (event.type !== 'set' || !selected) return;
    const time = { hour: selected.getHours(), minute: selected.getMinutes() };
    setReminder(time);
    setReminderTime(time); // persists + reschedules the local notification
  }

  async function clearSession() {
    await clearLocalData();
    await syncMeta.set('user_remote_id', '');
    router.replace('/login');
  }

  async function handleLogout() {
    await unregisterPushToken(); // must happen while the session is still valid
    await logout(); // revokes refresh token server-side + clears local tokens
    await clearSession();
  }

  async function handleExport() {
    setBusy(true);
    try {
      const res = await apiFetch('/users/me/export');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const uri = FileSystem.cacheDirectory + 'litopys-export.json';
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json' });
      } else {
        Alert.alert(t('profile.exportSaved'));
      }
    } catch {
      Alert.alert(t('profile.exportError'));
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      t('profile.deleteTitle'),
      t('profile.deleteMessage'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await apiFetch('/users/me', { method: 'DELETE' });
              if (!res.ok && res.status !== 204) throw new Error();
              await logout();
              await clearSession();
            } catch {
              Alert.alert(t('profile.deleteError'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingTop: insets.top + 32 }]}>
      <View style={s.inner}>
      <View style={s.header}>
        <Text style={s.name}>{profile?.name || '—'}</Text>
        <Text style={s.meta}>{profile?.email ?? ''}</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.count}</Text>
          <Text style={s.statLabel}>{t('profile.stats.entries')}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.streak}</Text>
          <Text style={s.statLabel}>{t('profile.stats.streak')}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.avg != null ? stats.avg.toFixed(1) : '—'}</Text>
          <Text style={s.statLabel}>{t('profile.stats.avg')}</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>{t('profile.settingsSection')}</Text>
      <View style={s.group}>
        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.editProfile')}</Text>
          <Text style={s.rowChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.reminderTime')}</Text>
          <Text style={s.rowValue}>
            {`${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`}
          </Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={new Date(2000, 0, 1, reminder.hour, reminder.minute)}
            mode="time"
            is24Hour
            display="default"
            onChange={onReminderChange}
          />
        )}

        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => setLangPickerOpen(true)} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.reportLanguage')}</Text>
          <Text style={s.rowValue}>{profile?.language || '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => router.push('/tour')} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.retakeTour')}</Text>
          <Text style={s.rowChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => router.push('/feedback')} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.contactUs')}</Text>
          <Text style={s.rowChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.rowDivider, s.rowBetween]} onPress={() => router.push('/privacy')} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.privacyPolicy')}</Text>
          <Text style={s.rowChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.row, s.rowDivider]} onPress={handleExport} disabled={busy} activeOpacity={0.7}>
          <Text style={s.rowText}>{t('profile.exportData')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.row} onPress={handleDeleteAccount} disabled={busy} activeOpacity={0.7}>
          <Text style={[s.rowText, s.danger]}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={busy} activeOpacity={0.8}>
        <Text style={s.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      <LanguagePickerModal
        visible={langPickerOpen}
        value={profile?.language ?? ''}
        options={REPORT_LANGUAGES}
        onSelect={saveReportLanguage}
        onClose={() => setLangPickerOpen(false)}
      />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 20, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 18 },
  name: { fontSize: 19, fontWeight: '800', color: '#26215C', marginBottom: 1 },
  meta: { fontSize: 12, color: '#928F87' },

  statsRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 16, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800', color: '#26215C' },
  statLabel: { fontSize: 10, fontWeight: '500', color: '#928F87', marginTop: 2 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#B4B2A9', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginTop: 22 },
  group: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE6', borderRadius: 15, overflow: 'hidden' },
  row: { paddingVertical: 13, paddingHorizontal: 15 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F2F0EA' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { fontSize: 13, color: '#2C2C2A', fontWeight: '500' },
  rowValue: { fontSize: 12.5, fontWeight: '600', color: '#928F87' },
  rowChevron: { fontSize: 13, fontWeight: '600', color: '#B4B2A9' },
  danger: { color: '#993C1D' },

  logoutBtn: { backgroundColor: '#FAECE7', borderRadius: 13, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  logoutText: { color: '#993C1D', fontSize: 13, fontWeight: '700' },
});
