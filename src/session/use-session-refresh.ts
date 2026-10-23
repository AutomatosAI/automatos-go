// Keeps the role the server's (KC12; D16, D17): mounted once by app/(app)/_layout.tsx, beside the
// gate rather than under it, so a workspace the gate shows as paused or lost is read again on
// resume too. On mount it is the launch; then AppState's return from the background, and every 403
// the query and mutation caches hear, go through the refresher (session-refresh.ts, decided by
// role-refresh.ts), which reads the workspace query again. Only wiring.

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isResume } from './role-refresh';
import { createSessionRefresher, watchRefusals } from './session-refresh';

export function useSessionRefresh(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = createSessionRefresher(queryClient);
    refresh('launch');
    let previous: string = AppState.currentState;
    const appState = AppState.addEventListener('change', (next) => {
      if (isResume(previous, next)) refresh('resume');
      previous = next;
    });
    const stopWatching = watchRefusals(queryClient, () => refresh('forbidden'));
    return () => {
      appState.remove();
      stopWatching();
    };
  }, [queryClient]);
}
