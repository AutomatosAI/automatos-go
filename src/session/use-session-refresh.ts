// Keeps the role the server's (KC12; D16, D17): mounted once by app/(app)/_layout.tsx, beside the
// gate rather than under it, so a workspace the gate shows as paused or lost is read again on
// resume too. On mount it is the launch; then AppState's return from the background, and every 403
// the query and mutation caches hear, go through the refresher (session-refresh.ts, decided by
// role-refresh.ts), which reads the workspace query again. The launch and every resume also rotate
// a paired phone's token once it is due (US-006i, src/connect/rotation.ts rotatesOn): never on a
// refusal, never per request. Only wiring.

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { tokenRotation } from '../connect/app-rotation';
import { rotatesOn } from '../connect/rotation';
import { isResume, type RefreshEvent } from './role-refresh';
import { createSessionRefresher, watchRefusals } from './session-refresh';

export function useSessionRefresh(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = createSessionRefresher(queryClient);
    const onEvent = (event: RefreshEvent) => {
      refresh(event);
      if (rotatesOn(event)) void tokenRotation.rotateIfDue();
    };
    onEvent('launch');
    let previous: string = AppState.currentState;
    const appState = AppState.addEventListener('change', (next) => {
      if (isResume(previous, next)) onEvent('resume');
      previous = next;
    });
    const stopWatching = watchRefusals(queryClient, () => onEvent('forbidden'));
    return () => {
      appState.remove();
      stopWatching();
    };
  }, [queryClient]);
}
