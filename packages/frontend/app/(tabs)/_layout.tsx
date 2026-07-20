import { useEffect } from 'react';
import { AppState, AppStateStatus, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setupNotifications, clearDeliveredNotifications } from '@/utils/notifications';
import { useAutoSync } from '@/hooks/useAutoSync';

export default function TabsLayout() {
  const { t } = useTranslation();

  // Auto-sync on app foreground and when connectivity is restored, so data
  // entered offline gets pushed without a manual sync button.
  useAutoSync();

  // The tabs area only mounts for authenticated users, so the push token
  // registration call is guaranteed to have a session.
  useEffect(() => {
    setupNotifications();
  }, []);

  // Dismiss any tray notifications (and clear the icon badge) whenever the app
  // is in the foreground — on cold open and on every return to 'active'. A
  // report-ready push is stale once the user is already in the app.
  useEffect(() => {
    void clearDeliveredNotifications();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void clearDeliveredNotifications();
    });
    return () => sub.remove();
  }, []);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#7F77DD',
        tabBarInactiveTintColor: '#B4B2A9',
        tabBarStyle: { borderTopColor: '#F0EEE8' },
        headerStyle: { backgroundColor: '#534AB7' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="notesList"
        options={{
          title: t('tabs.notes'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✎</Text>,
        }}
      />
      <Tabs.Screen
        name="summaryList"
        options={{
          title: t('tabs.summary'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>↗</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◎</Text>,
        }}
      />
    </Tabs>
  );
}
