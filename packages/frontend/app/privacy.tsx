import { ScrollView, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.title}>{t('privacy.title')}</Text>
      <Text style={s.body}>{t('privacy.body')}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#26215C', marginBottom: 16 },
  body: { fontSize: 14, color: '#3A3A38', lineHeight: 22 },
});
