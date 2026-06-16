import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import { scheduleDailyReminder } from './notifications';

// The UI language is decoupled from the report-generation language (user.language):
// it's limited to the locales we ship translations for, and lives on the device only.
export const APP_LANGUAGES = ['uk', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

// Display names are always shown in their own language, so they aren't translated.
export const APP_LANGUAGE_LABELS: Record<AppLanguage, string> = {
  uk: 'Українська',
  en: 'English',
};

const APP_LANGUAGE_KEY = 'bcr_app_language';

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'uk' || value === 'en';
}

/** The persisted UI language, or null to fall back to the device locale. */
export async function getStoredAppLanguage(): Promise<AppLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
    if (isAppLanguage(raw)) return raw;
  } catch {
    // fall through to null (device locale)
  }
  return null;
}

/** Apply the saved UI language on startup. No-op if nothing was saved. */
export async function loadAppLanguage(): Promise<void> {
  const stored = await getStoredAppLanguage();
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
}

/** Switch the UI language live, persist it, and refresh the localized reminder text. */
export async function setAppLanguage(lng: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(APP_LANGUAGE_KEY, lng);
  await i18n.changeLanguage(lng);
  try {
    await scheduleDailyReminder(); // re-render the daily notification in the new language
  } catch {
    // best-effort: notifications may be unavailable or unpermitted
  }
}
