import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/api-client/auth-store';

export default function Page() {
  const [target, setTarget] = useState<'/(tabs)' | '/login' | null>(null);

  useEffect(() => {
    getAccessToken().then(token => setTarget(token ? '/(tabs)' : '/login'));
  }, []);

  if (!target) return null; // поки читаємо токен — нічого не показуємо
  return <Redirect href={target} />;
}
