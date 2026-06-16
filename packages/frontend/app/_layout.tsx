import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDb } from '@/db/schema';
import { useTranslation } from 'react-i18next';
import '@/i18n';
import { loadAppLanguage } from '@/utils/locale';

export default function RootLayout() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);

  // Apply the saved UI language before the first render so screens don't flash
  // in the device locale and then switch.
  useEffect(() => {
    loadAppLanguage().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SQLiteProvider databaseName="bcr.db" onInit={migrateDb}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="goal" options={{ title: t('nav.newGoal') }} />
        <Stack.Screen name="goal/[id]" options={{ title: t('nav.addNote') }} />
        <Stack.Screen name="notes/[id]" options={{ title: t('nav.notesList') }} />
        <Stack.Screen name="privacy" options={{ title: t('profile.privacyPolicy') }} />
      </Stack>
    </SQLiteProvider>
  );
}
