// Settings → Style and look → Candy's look (US-023m): Make it sweet. The shell's StyleSync reads the
// looks and sends each change as it is made where the style is installed in the workspace (US-017d,
// US-023c); this one reads only if no other is mounted (sync/reader-guard.ts). Until Candy's look
// page lands, the page says it is coming (src/styles/candy/CandyLookStandIn).
// CANDY_STAND_IN US-023m
import { CandyLookStandIn } from '../../../../src/styles/candy/CandyLookStandIn';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function CandyLookSettings() {
  return (
    <>
      <StyleSync />
      <CandyLookStandIn />
    </>
  );
}
