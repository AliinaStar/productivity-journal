import { Text, TouchableOpacity, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

const MONTHS = [
  { id: 'm0', label: 'October 2025',  score: '5.0', days: '3 goals', headline: 'From starting to operating' },
  { id: 'm1', label: 'June 2025',     score: '4.0', days: '24/30', headline: 'The month you figured out your rhythm' },
  { id: 'm2', label: 'May 2025',      score: '3.6', days: '20/31', headline: 'Slow start, strong finish' },
  { id: 'm3', label: 'April 2025',    score: '3.8', days: '22/30', headline: 'Finding consistency in small habits' },
];

export default function MonthList() {
  const router = useRouter();

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.header}>Monthly reports</Text>
      {MONTHS.map(m => (
        <TouchableOpacity
          key={m.id}
          style={s.card}
          onPress={() => router.push(`/summary/month/${m.id}`)}
          activeOpacity={0.7}
        >
          <View style={s.cardTop}>
            <Text style={s.cardLabel}>{m.label}</Text>
            <Text style={s.cardScore}>{m.score} avg</Text>
          </View>
          <Text style={s.cardHeadline}>{m.headline}</Text>
          <Text style={s.cardDays}>{m.days} active days</Text>
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
  cardHeadline: { fontSize: 13, color: '#5F5E5A', marginBottom: 4, lineHeight: 18 },
  cardDays: { fontSize: 12, color: '#B4B2A9' },
});
