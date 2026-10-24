// Keeps Play's and HUD's looks in step with the web (US-017d, D55, D59): on mount and on every
// return to the foreground it reads the member's looks for both themes and sends what the phone
// changed (sync/look-sync-run.ts); a change made on a look page or in HUD's drawer is sent as it is
// made, while this is mounted. Nothing polls. Mounted through StyleSync: on A5's own screens in
// phase 1 (the Style and look screen, the look pages), so the looks are read when they open, and
// once in the signed-in shell from US-016j. Renders nothing.

import { useEffect } from 'react';

import { useAppSession } from '../../app-state/session';
import { lookSyncNotice, type LookSyncStatus } from '../play/look-sync';
import { useStyleRoot, useStyleStore } from '../provider/context';
import { sessionKey } from '../themes/sync';
import { onForegroundReturn } from './foreground';
import type { LookThemeKey } from './look-marks';
import { lookSyncRunners, type LookSyncTarget } from './look-sync-run';
import { NOT_INSTALLED_COPY } from './look-themes';

export function LookSync(): null {
  const { client, workspace } = useAppSession();
  const { store } = useStyleRoot();
  const session = sessionKey(client.server.apiUrl, workspace.id);

  // a new server or workspace is a new target: read again
  useEffect(() => {
    const target: LookSyncTarget = { client, session };
    const { play, hud } = lookSyncRunners(store);
    const detaches = [play.attach(target), hud.attach(target)];
    const read = () => {
      void play.refresh(target);
      void hud.refresh(target);
    };
    read();
    const stop = onForegroundReturn(read);
    return () => {
      stop();
      detaches.forEach((detach) => detach());
    };
  }, [client, session, store]);

  return null;
}

/** One theme's standing with the server, for its look page. */
export function useLookSyncStatus(key: LookThemeKey): LookSyncStatus {
  return useStyleStore((state) => state.lookSync[key]);
}

/** What a look page says about the sync: the not-installed words (Play), a failure's, or null. */
export function useLookSyncNotice(key: LookThemeKey): string | null {
  return lookSyncNotice(useLookSyncStatus(key), NOT_INSTALLED_COPY[key]);
}
