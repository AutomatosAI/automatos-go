// The one component that keeps the phone's style data in step with the server (PRD-001 §4.6, D59):
// it reads on mount and on every foreground and renders nothing. A5's own screens mount it in
// phase 1 (the Style and look screen, and the look pages when they arrive), so their data is read
// when they open; US-016j mounts it once in the signed-in shell in phase 2. No polling.
//
// Its readers: US-016i's ThemeSync (GET /api/themes/active and the offered installs' phone
// paintings, themes/ThemeSync.tsx) and US-017d's LookSync (Play's and HUD's looks through GET/PUT
// /api/themes/looks/automatos/play and /automatos/hud, one save at a time, sync/LookSync.tsx).

import { ThemeSync } from '../themes/ThemeSync';
import { LookSync } from './LookSync';

export function StyleSync() {
  return (
    <>
      <ThemeSync />
      <LookSync />
    </>
  );
}
