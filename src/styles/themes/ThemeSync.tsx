// Keeps the phone in step with the theme Studio shows (D-PHONE-CHOICE, D58): reads GET
// /api/themes/active and the offered installs' phone paintings on mount and on every return to the
// foreground (sync.ts refreshThemes); nothing pushes a change and nothing polls. The last answers
// are kept on the phone for the first frame (themes/cache.ts, through the style store). A theme on
// screen that is gone puts the phone back on Studio with one toast. Renders nothing.
//
// Mounted through StyleSync (src/styles/sync/StyleSync.tsx). FOUNDATION GAP: the style provider
// sits above the sign-in root and the gate (app/_layout.tsx), so the session's client and
// discovery are not reachable from it; in phase 1 StyleSync is mounted by A5's own screens (the
// Style and look screen), and US-016j mounts it once in the signed-in shell. The picker also asks
// for a read when it opens (useThemeRefresh), which joins a read already running.

import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { isForeground } from '../../api/live-connection';
import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { useStyleRoot } from '../provider/context';
import { THEME_COPY } from '../strings';
import { refreshThemes, sessionKey, watchPaintFiles } from './sync';

/** Calls `onReturn` each time the app comes back to the foreground; returns the unsubscribe. */
function onForegroundReturn(onReturn: () => void): () => void {
  let wasForeground = isForeground(AppState.currentState);
  const subscription = AppState.addEventListener('change', (next) => {
    const foreground = isForeground(next);
    if (foreground && !wasForeground) onReturn();
    wasForeground = foreground;
  });
  return () => subscription.remove();
}

/** One read of the workspace's themes, applied (joins a read already running). */
export function useThemeRefresh(): () => Promise<void> {
  const { client, discovery, workspace } = useAppSession();
  const session = sessionKey(client.server.apiUrl, workspace.id);
  const { store, crossfade, input } = useStyleRoot();
  const { reduceMotion } = input;
  const toast = useToast();
  return useCallback(
    () =>
      refreshThemes({
        session,
        client,
        discovery,
        store,
        crossfade,
        reduceMotion,
        onLost: () => toast.show(THEME_COPY.lost),
      }),
    [session, client, discovery, store, crossfade, reduceMotion, toast],
  );
}

export function ThemeSync(): null {
  const refresh = useThemeRefresh();
  const { client } = useAppSession();
  const { store } = useStyleRoot();

  // a new server or workspace is a new refresh (its session): read again
  useEffect(() => {
    void refresh();
    return onForegroundReturn(() => void refresh());
  }, [refresh]);

  useEffect(() => watchPaintFiles(client, store), [client, store]);

  return null;
}
