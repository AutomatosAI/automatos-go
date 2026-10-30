// Settings → Style and look → Arcade's look (US-022j): Options. The shell's StyleSync reads Arcade's
// looks and sends each change as it is made where Arcade is installed in the workspace (US-017d,
// US-022c); this one reads only if no other is mounted (sync/reader-guard.ts). The page is
// src/styles/arcade/look-page/ArcadeLookPage.
import { ArcadeLookPage } from '../../../../src/styles/arcade/look-page/ArcadeLookPage';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function ArcadeLookSettings() {
  return (
    <>
      <StyleSync />
      <ArcadeLookPage />
    </>
  );
}
