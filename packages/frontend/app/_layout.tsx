import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { migrateDb } from '@/db/schema';
import { getAccessToken } from '@/api-client/auth-store';
import { useTranslation } from 'react-i18next';
import '@/i18n';

function AuthGuard() {
  useEffect(() => {
    getAccessToken().then(token => {
      if (!token) router.replace('/login');
    });
  }, []);
  return null;
}

export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <SQLiteProvider databaseName="bcr.db" onInit={migrateDb}>
      <StatusBar style="auto" />
      <AuthGuard />
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
