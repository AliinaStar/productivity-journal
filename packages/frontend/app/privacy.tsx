import { ScrollView, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
// Single source of truth. The same file is what we host at the public policy
// URL, so the in-app text and the hosted page can never drift apart.
import policySource from '../../../docs/privacy-policy.md';

// The screen renders plain text, so turn the Markdown into a clean readable
// blob: drop front matter, the top-level heading (shown as the screen title),
// heading markers, bold markers and horizontal rules; normalise bullets.
function toPlainText(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^\s*#\s+.*\n+/, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const POLICY_TEXT = toPlainText(policySource);

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.title}>{t('privacy.title')}</Text>
      <Text style={s.body}>{POLICY_TEXT}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F4F0' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#26215C', marginBottom: 16 },
  body: { fontSize: 14, color: '#3A3A38', lineHeight: 22 },
});
