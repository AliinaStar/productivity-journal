import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGoals } from '@/db/goals';
import { useEntries } from '@/db/entries';
import { Goal, Entry } from '@/db/types';
import { GoalDetailView } from '@/components/goal-detail-view';
import { RecordEntrySheet } from '@/components/record-entry-sheet';

export default function GoalDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalsDb = useGoals();
  const entriesDb = useEntries();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [g, list] = await Promise.all([goalsDb.getById(id), entriesDb.getByGoal(id)]);
      setGoal(g);
      setHistory(list);
      setLoading(false);
    })();
  }, [id]));

  if (loading || !goal) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#7F77DD" />
      </View>
    );
  }

  async function reload() {
    setHistory(await entriesDb.getByGoal(id));
  }

  async function handleEntrySaved() {
    setEditingEntry(null);
    await reload();
  }

  function handleDeleteEntry(entry: Entry) {
    Alert.alert(
      t('entry.deleteTitle'),
      t('entry.deleteMessage'),
      [
        { text: t('entry.cancel'), style: 'cancel' },
        {
          text: t('entry.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            // Local-first: the row is tombstoned now and the DELETE is pushed
            // on the next sync, so this works offline like everything else.
            await entriesDb.remove(entry.id);
            await reload();
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <GoalDetailView
        goal={goal}
        history={history}
        onEditEntry={setEditingEntry}
        onDeleteEntry={handleDeleteEntry}
        action={
          <Pressable style={s.editBtn} onPress={() => router.push(`/goal/edit/${goal.id}`)} hitSlop={8}>
            <Text style={s.editBtnText}>{t('goalDetail.edit')}</Text>
          </Pressable>
        }
      />
      <RecordEntrySheet
        goal={editingEntry ? goal : null}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={handleEntrySaved}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 20, paddingTop: 22, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F4F0' },

  editBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  editBtnText: { fontSize: 13.5, fontWeight: '700', color: '#7F77DD' },
});
