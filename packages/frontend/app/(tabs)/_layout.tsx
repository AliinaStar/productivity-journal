import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setupNotifications } from '@/utils/notifications';

export default function TabsLayout() {
  const { t } = useTranslation();

  // The tabs area only mounts for authenticated users, so the push token
  // registration call is guaranteed to have a session.
  useEffect(() => {
    setupNotifications();
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
