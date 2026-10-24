// Notification responses, for React (PRD-001 §4.8): PushRoot (US-014g) mounts this once inside the
// signed-in shell, where expo-router's root navigator is already mounted, so a cold start's response
// waits for sign-in, discovery and the workspace bootstrap. On mount it handles the response that
// opened the app (getLastNotificationResponse, then clearLastNotificationResponse) and listens for
// warm taps (addNotificationResponseReceivedListener); unmount stops listening. Only wiring: the
// logic is responses.ts and handler.ts. Pass deps memoized: a new object listens again.

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useToast } from '../../ui';
import { startResponses, type ResponsesDeps } from './responses';

export type NotificationResponsesDeps = Omit<ResponsesDeps, 'navigate' | 'notify'>;

export function useNotificationResponses(deps: NotificationResponsesDeps): void {
  const router = useRouter();
  const { show } = useToast();
  useEffect(() => {
    const responses = startResponses({
      ...deps,
      navigate: (route: string) => router.push(route),
      notify: show,
    });
    return () => responses.remove();
  }, [deps, router, show]);
}
