// Keeps Play's, HUD's, Arcade's and Candy's looks in step with the web (US-017d, D55, D59, D-ARC-3,
// D-CAN-3): on mount and on every return to the foreground it reads the member's looks for each
// theme and sends what the phone changed (sync/look-sync-run.ts); a change made on a look page or
// in HUD's drawer is sent as it is made, while this is mounted. Nothing polls. Mounted through
// StyleSync: on A5's own screens in phase 1 (the Style and look screen, the look pages), so the
// looks are read when they open, and once in the signed-in shell from US-016j. Renders nothing.

import { useEffect } from 'react';

import { useAppSession } from '../../app-state/session';
import { useAuthSession } from '../../auth/AuthRoot';
import { lookSyncNotice, type LookSyncStatus } from '../play/look-sync';
import { useStyleRoot, useStyleStore } from '../provider/context';
import { onForegroundReturn } from './foreground';
import type { LookThemeKey } from './look-marks';
import { lookOwner, lookSyncRunners, type LookSyncTarget } from './look-sync-run';
import { NOT_INSTALLED_COPY } from './look-themes';

export function LookSync(): null {
  const { client, workspace } = useAppSession();
  const { ownerId } = useAuthSession();
  const { store } = useStyleRoot();
  const session = lookOwner(client.server.apiUrl, workspace.id, ownerId);

  // a new server, workspace or user is a new owner: its own looks, read again
  useEffect(() => {
    const target: LookSyncTarget = { client, session };
    const { play, hud, arcade, candy } = lookSyncRunners(store);
    const runners = [play, hud, arcade, candy];
    const detaches = runners.map((runner) => runner.attach(target));
    const read = () => {
      runners.forEach((runner) => void runner.refresh(target));
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

/** A look page's sync line: Play's, Arcade's or Candy's not-installed words, a failure's, or null. */
export function useLookSyncNotice(key: LookThemeKey): string | null {
  return lookSyncNotice(useLookSyncStatus(key), NOT_INSTALLED_COPY[key]);
}
