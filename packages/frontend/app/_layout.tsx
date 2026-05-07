import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { migrateDb } from '@/db/schema';
import { useSyncMeta } from '@/db/sync';

function AuthGuard() {
  const syncMeta = useSyncMeta();
  useEffect(() => {
    syncMeta.getUserRemoteId().then(id => {
      if (!id) router.replace('/login');
    });
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="bcr.db" onInit={migrateDb}>
      <StatusBar style="auto" />
      <AuthGuard />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="goal" options={{ title: 'Нова ціль' }} />
        <Stack.Screen name="goal/[id]" options={{ title: 'Додати нотатку' }} />
        <Stack.Screen name="notes/[id]" options={{ title: 'Нотатки' }} />
      </Stack>
    </SQLiteProvider>
  );
}
