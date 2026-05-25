import Constants from 'expo-constants';

function getBaseUrl(): string {
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:8000`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
}

export const BASE_URL = getBaseUrl();
