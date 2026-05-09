import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useGoals } from '@/db/goals';
import { GoalStatus } from '@/db/types';

export default function GoalAdder() {
  const { t } = useTranslation();
  const goals = useGoals();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [status, setStatus] = useState<GoalStatus>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STATUS_KEYS: GoalStatus[] = ['active', 'postpone', 'finished'];

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowPicker(false);
    if (selected) setDeadline(selected);
  }

  async function handleSave() {
    if (!title.trim()) { setError(t('goal.errorTitle')); return; }
    setSaving(true);
    setError(null);
    try {
      await goals.create({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline ? deadline.toISOString().split('T')[0] : undefined,
        status,
      });
      router.back();
    } catch {
      setError(t('goal.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';

  return (
    <View style={s.container}>
      <Text style={s.label}>{t('goal.titleLabel')}</Text>
      <TextInput style={s.input} placeholder={t('goal.titlePlaceholder')} value={title} onChangeText={setTitle} />

      <Text style={s.label}>{t('goal.descLabel')}</Text>
      <TextInput style={[s.input, s.multiline]} placeholder={t('goal.descPlaceholder')} value={description} onChangeText={setDescription} multiline />

      <Text style={s.label}>{t('goal.deadlineLabel')}</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setShowPicker(true)}>
        <Text style={s.dateBtnText}>
          {deadline ? deadline.toLocaleDateString(locale) : t('goal.pickDate')}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker value={deadline ?? new Date()} mode="date" display="default" onChange={onDateChange} />
      )}

      <Text style={s.label}>{t('goal.statusLabel')}</Text>
      <View style={s.statusRow}>
        {STATUS_KEYS.map(key => (
          <TouchableOpacity key={key} style={[s.statusChip, status === key && s.statusChipActive]} onPress={() => setStatus(key)}>
            <Text style={[s.statusChipText, status === key && s.statusChipTextActive]}>
              {t(`goal.statuses.${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('goal.save')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F4F0' },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, color: '#2C2C2A' },
  multiline: { height: 90, textAlignVertical: 'top' },
  dateBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: '#2C2C2A' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff' },
  statusChipActive: { backgroundColor: '#7F77DD' },
  statusChipText: { fontSize: 13, color: '#888780' },
  statusChipTextActive: { color: '#fff', fontWeight: '600' },
  error: { fontSize: 13, color: '#993C1D', marginTop: 12 },
  saveBtn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
