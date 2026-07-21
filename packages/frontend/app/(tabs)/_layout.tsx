import { useEffect } from 'react';
import { AppState, AppStateStatus, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setupNotifications, clearDeliveredNotifications } from '@/utils/notifications';
import { useAutoSync } from '@/hooks/useAutoSync';
import { NavIcon, NavShape } from '@/components/nav-icon';

// Icons are drawn from Views (see NavIcon) rather than an icon font or emoji,
// neither of which rendered on the target device. A light "pill" behind the
// active tab is the active-state cue since labels are hidden.
function TabIcon({ shape, color, focused }: { shape: NavShape; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <NavIcon shape={shape} color={color} />
    </View>
  );
}

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
        tabBarShowLabel: false,
        tabBarStyle: { borderTopColor: '#F0EEE8' },
        headerStyle: { backgroundColor: '#534AB7' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: t('tabs.today'),
          tabBarIcon: ({ color, focused }) => <TabIcon shape="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="summaryList"
        options={{
          headerShown: false,
          title: t('tabs.overview'),
          tabBarIcon: ({ color, focused }) => <TabIcon shape="bars" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => <TabIcon shape="person" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    paddingHorizontal: 17,
    paddingVertical: 6,
    borderRadius: 14,
  },
  iconPillActive: {
    backgroundColor: '#EEEDFE',
  },
});
