import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSync } from './useSync';

/**
 * Keeps the backend in sync without a manual button:
 *  - when the app returns to the foreground (throttled, via syncIfStale)
 *  - when connectivity is restored after being offline (immediate full sync)
 *
 * This is what flushes entries/goals that were created while offline — the
 * next time the app is opened or the connection comes back, they're pushed.
 * Mount once in the authenticated area.
 */
export function useAutoSync() {
  const { sync, syncIfStale } = useSync();
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void syncIfStale();
    });

    const netInfoUnsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      // Only react to an offline -> online transition, not the initial reading.
      if (connected && wasConnected.current === false) void sync();
      wasConnected.current = connected;
    });

    return () => {
      appStateSub.remove();
      netInfoUnsub();
    };
  }, []);
}
