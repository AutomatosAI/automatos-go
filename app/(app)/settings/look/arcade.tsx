// Settings → Style and look → Arcade's look (US-022j): Options. The shell's StyleSync reads the
// looks and sends each change as it is made where the style is installed in the workspace (US-017d,
// US-016j); this one reads only if no other is mounted (sync/reader-guard.ts). Until Arcade's
// Options page lands, the page says it is coming (src/styles/arcade/ArcadeLookStandIn).
// ARCADE_STAND_IN US-022j
import { ArcadeLookStandIn } from '../../../../src/styles/arcade/ArcadeLookStandIn';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function ArcadeLookSettings() {
  return (
    <>
      <StyleSync />
      <ArcadeLookStandIn />
    </>
  );
}
