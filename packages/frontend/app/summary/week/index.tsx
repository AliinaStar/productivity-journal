import { Text, TouchableOpacity, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

const WEEKS = [
  { id: 'w0', label: 'Jul 28 – Aug 3', dates: 'Weekly Report', score: '4.0', days: 'Steady' },
  { id: 'w1', label: 'Week 23', dates: 'Jun 2 – 8',  score: '4.1', days: '6/7' },
  { id: 'w2', label: 'Week 22', dates: 'May 26 – Jun 1', score: '3.8', days: '5/7' },
  { id: 'w3', label: 'Week 21', dates: 'May 19 – 25', score: '4.3', days: '7/7' },
];

export default function WeekList() {
  const router = useRouter();

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.header}>Weekly reports</Text>
      {WEEKS.map(w => (
        <TouchableOpacity
          key={w.id}
          style={s.card}
          onPress={() => router.push(`/summary/week/${w.id}`)}
          activeOpacity={0.7}
        >
          <View style={s.cardTop}>
            <Text style={s.cardLabel}>{w.label}</Text>
            <Text style={s.cardScore}>{w.score} avg</Text>
          </View>
          <Text style={s.cardDates}>{w.dates}</Text>
          <Text style={s.cardDays}>{w.days} active days</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  header: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  cardScore: { fontSize: 13, color: '#7F77DD', fontWeight: '500' },
  cardDates: { fontSize: 13, color: '#5F5E5A', marginBottom: 2 },
  cardDays: { fontSize: 12, color: '#B4B2A9' },
});
