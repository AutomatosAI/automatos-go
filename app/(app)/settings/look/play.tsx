// Settings → Style and look → Play's 'Make it yours' (US-017e): the look page. The shell's StyleSync
// reads Play's looks and sends each change as it is made (US-017d, US-016j); this one reads only if
// no other is mounted (sync/reader-guard.ts). The page is src/styles/play/look-page/PlayLookPage.
import { PlayLookPage } from '../../../../src/styles/play/look-page/PlayLookPage';
import { StyleSync } from '../../../../src/styles/sync/StyleSync';

export default function PlayLookSettings() {
  return (
    <>
      <StyleSync />
      <PlayLookPage />
    </>
  );
}
