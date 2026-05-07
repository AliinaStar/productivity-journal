import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useGoals } from '@/db/goals';
import { GoalStatus } from '@/db/types';

const STATUS_OPTIONS: { label: string; value: GoalStatus; color: string }[] = [
  { label: 'Активна',   value: 'active',   color: '#7F77DD' },
  { label: 'Відкладена', value: 'postpone', color: '#B4B2A9' },
  { label: 'Завершена',  value: 'finished', color: '#4CAF88' },
];

export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [status, setStatus] = useState<GoalStatus>('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    goals.getById(id).then(goal => {
      if (!goal) return;
      setTitle(goal.title);
      setDescription(goal.description ?? '');
      setDeadline(goal.deadline ? new Date(goal.deadline) : null);
      setStatus(goal.status);
      setLoading(false);
    });
  }, [id]);

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowPicker(false);
    if (selected) setDeadline(selected);
  }

  async function handleSave() {
    if (!title.trim()) { setError('Введи назву цілі'); return; }
    setSaving(true);
    setError(null);
    try {
      await goals.update(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline ? deadline.toISOString().split('T')[0] : undefined,
        status,
      });
      router.back();
    } catch {
      setError('Помилка збереження');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#7F77DD" />
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Назва цілі</Text>
      <TextInput
        style={s.input}
        placeholder="Назва"
        placeholderTextColor="#B4B2A9"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={s.label}>Опис</Text>
      <TextInput
        style={[s.input, s.multiline]}
        placeholder="Додатковий контекст..."
        placeholderTextColor="#B4B2A9"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={s.label}>Дедлайн</Text>
      <View style={s.dateRow}>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={s.dateBtnText}>
            {deadline ? deadline.toLocaleDateString('uk-UA') : 'Вибрати дату'}
          </Text>
        </TouchableOpacity>
        {deadline && (
          <TouchableOpacity onPress={() => setDeadline(null)} style={s.clearDate}>
            <Text style={s.clearDateText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {showPicker && (
        <DateTimePicker value={deadline ?? new Date()} mode="date" display="default" onChange={onDateChange} />
      )}

      <Text style={s.label}>Статус</Text>
      <View style={s.statusRow}>
        {STATUS_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[s.statusChip, status === opt.value && { backgroundColor: opt.color, borderColor: opt.color }]}
            onPress={() => setStatus(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[s.statusChipText, status === opt.value && s.statusChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Зберегти</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={s.cancelText}>Скасувати</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 20, paddingTop: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, color: '#2C2C2A' },
  multiline: { height: 90, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  dateBtnText: { fontSize: 15, color: '#2C2C2A' },
  clearDate: { padding: 10 },
  clearDateText: { fontSize: 16, color: '#B4B2A9' },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E4DF' },
  statusChipText: { fontSize: 13, color: '#888780', fontWeight: '500' },
  statusChipTextActive: { color: '#fff', fontWeight: '600' },
  error: { fontSize: 13, color: '#993C1D', marginTop: 12 },
  saveBtn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelText: { fontSize: 14, color: '#888780' },
});
