import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/api-client/client';
import i18n from '@/i18n';

// How notifications are presented while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export interface ReminderTime {
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 20, minute: 0 };

// The reminder is a local notification, so its time lives on the device only.
const REMINDER_TIME_KEY = 'bcr_reminder_time'; // "HH:MM"

/** Read the user's chosen daily reminder time (falls back to 20:00). */
export async function getReminderTime(): Promise<ReminderTime> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_TIME_KEY);
    if (raw) {
      const [hour, minute] = raw.split(':').map(Number);
      if (Number.isInteger(hour) && Number.isInteger(minute)) return { hour, minute };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_REMINDER_TIME;
}

/** Persist a new daily reminder time and reschedule the notification. */
export async function setReminderTime(time: ReminderTime): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, `${time.hour}:${time.minute}`);
  if (Platform.OS === 'web') return;
  try {
    await scheduleDailyReminder();
  } catch (e) {
    console.warn('Failed to reschedule daily reminder:', e);
  }
}

/**
 * One-stop setup, called when the authenticated area mounts:
 *  1. asks for notification permission,
 *  2. (re)schedules the local daily "write a note" reminder,
 *  3. registers the device's Expo push token on the backend so the server
 *     can notify when a report is generated.
 * Best-effort: any failure is logged and swallowed.
 */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Litopys',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await scheduleDailyReminder();
    await registerPushToken();
  } catch (e) {
    console.warn('Notification setup failed:', e);
  }
}

/** Schedule the daily local reminder, replacing any previously scheduled one. */
export async function scheduleDailyReminder(): Promise<void> {
  const { hour, minute } = await getReminderTime();
  // The reminder is the only local notification the app schedules, so a full
  // cancel keeps exactly one copy (and refreshes the text after a language change).
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('notifications.dailyTitle'),
      body: i18n.t('notifications.dailyBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/** Fetch the Expo push token and store it on the backend. */
async function registerPushToken(): Promise<void> {
  // Push tokens only exist on physical devices (not simulators / Expo Go on Android).
  if (!Device.isDevice) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await apiFetch('/users/me/push-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/**
 * Clear notifications already sitting in the tray and reset the app-icon badge.
 *
 * Called when the app comes to the foreground: a "report ready" push has done
 * its job the moment the user is looking at the app, so leaving it in the tray
 * (and the badge on the icon) is just stale noise. Previously a notification
 * only cleared if you tapped it. Best-effort — any failure is swallowed.
 */
export async function clearDeliveredNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    console.warn('Failed to clear delivered notifications:', e);
  }
}

/** Best-effort: tell the backend to stop pushing to this device (used on logout). */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await apiFetch('/users/me/push-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: null }),
    });
  } catch {
    // Stale tokens are also cleaned up server-side on DeviceNotRegistered.
  }
}
