// The one foreground signal the style syncs read on (ThemeSync, LookSync): no timers, no polling.

import { AppState } from 'react-native';

import { isForeground } from '../../api/live-connection';

/** Calls `onReturn` each time the app comes back to the foreground; returns the unsubscribe. */
export function onForegroundReturn(onReturn: () => void): () => void {
  let wasForeground = isForeground(AppState.currentState);
  const subscription = AppState.addEventListener('change', (next) => {
    const foreground = isForeground(next);
    if (foreground && !wasForeground) onReturn();
    wasForeground = foreground;
  });
  return () => subscription.remove();
}
