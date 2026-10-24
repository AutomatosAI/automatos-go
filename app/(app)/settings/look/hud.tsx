// Settings → Style and look → HUD's look (US-018c): the Looks drawer. StyleSync is mounted so HUD's
// looks are read when the page opens and each change is sent as it is made where HUD is installed
// in the workspace (US-017d); the page is src/styles/hud/drawer/HudLookPage.
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
