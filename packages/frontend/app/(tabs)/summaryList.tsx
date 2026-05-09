import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

type NavItem = { key: string; label: string; route: '/summary/week' | '/summary/month' | '/summary/year' };

export default function SummaryHome() {
  const { t } = useTranslation();
  const router = useRouter();

  const items: NavItem[] = [
    { key: 'week',  label: t('summary.weeks'),  route: '/summary/week' },
    { key: 'month', label: t('summary.months'), route: '/summary/month' },
    { key: 'year',  label: t('summary.years'),  route: '/summary/year' },
  ];

  return (
    <View style={s.container}>
      <Text style={s.title}>{t('summary.title')}</Text>
      {items.map(item => (
        <TouchableOpacity key={item.key} style={s.card} onPress={() => router.push(item.route)} activeOpacity={0.7}>
          <Text style={s.cardLabel}>{item.label}</Text>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F4F0', padding: 20, paddingTop: 28 },
  title: { fontSize: 22, fontWeight: '700', color: '#26215C', marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  arrow: { fontSize: 22, color: '#B4B2A9' },
});
