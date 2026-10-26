// The one component that keeps the phone's style data in step with the server (PRD-001 §4.6, D59):
// it reads on mount and on every foreground and renders nothing. The signed-in shell mounts it
// once for the app (app/(app)/_layout.tsx, US-016j), after the bootstrap and the consent step, so
// the looks and the workspace's theme are read from launch. A5's own screens still mount it (the
// Style and look screen, the look pages); the guard (reader-guard.ts) keeps one reader per
// process, so under the shell's instance theirs read nothing. No polling.
//
// Its readers: US-016i's ThemeSync (GET /api/themes/active and the offered installs' phone
// paintings, themes/ThemeSync.tsx) and US-017d's LookSync (Play's and HUD's looks through GET/PUT
// /api/themes/looks/automatos/play and /automatos/hud, one save at a time, sync/LookSync.tsx).

import { useEffect, useState, useSyncExternalStore } from 'react';

import { ThemeSync } from '../themes/ThemeSync';
import { LookSync } from './LookSync';
import { STYLE_SYNC_READER } from './reader-guard';

/** Whether this StyleSync is the app's one reader. */
function useHoldsReader(): boolean {
  const [id] = useState(() => Symbol('StyleSync'));
  useEffect(() => STYLE_SYNC_READER.join(id), [id]);
  return useSyncExternalStore(STYLE_SYNC_READER.subscribe, () => STYLE_SYNC_READER.holds(id));
}

export function StyleSync() {
  if (!useHoldsReader()) return null;
  return (
    <>
      <ThemeSync />
      <LookSync />
    </>
  );
}
