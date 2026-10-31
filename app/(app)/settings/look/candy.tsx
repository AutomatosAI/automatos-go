// Settings → Style and look → Candy's look (US-023m): Make it sweet. The shell's StyleSync reads
// Candy's looks and sends each change as it is made where Candy is installed in the workspace
// (US-017d, US-023c); this one reads only if no other is mounted (sync/reader-guard.ts). The page is
// src/styles/candy/look-page/CandyLookPage.
import { CandyLookPage } from '../../../../src/styles/candy/look-page/CandyLookPage';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function CandyLookSettings() {
  return (
    <>
      <StyleSync />
      <CandyLookPage />
    </>
  );
}
