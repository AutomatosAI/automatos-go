// Settings → Style and look → HUD's look (US-018c): the Looks drawer. The shell's StyleSync reads
// HUD's looks and sends each change as it is made where HUD is installed in the workspace (US-017d,
// US-016j); this one reads only if no other is mounted (sync/reader-guard.ts). The page is
// src/styles/hud/drawer/HudLookPage.
import { HudLookPage } from '../../../../src/styles/hud/drawer/HudLookPage';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function HudLookSettings() {
  return (
    <>
      <StyleSync />
      <HudLookPage />
    </>
  );
}
