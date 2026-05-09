import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import uk from './locales/uk.json';
import en from './locales/en.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'uk';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: uk },
      en: { translation: en },
    },
    lng: deviceLang === 'uk' ? 'uk' : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
