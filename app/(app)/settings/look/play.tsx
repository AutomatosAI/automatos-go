// Settings → Style and look → Play's 'Make it yours' (US-017e): the look page. StyleSync is mounted
// so Play's looks are read when the page opens and each change is sent as it is made (US-017d);
// the page is src/styles/play/look-page/PlayLookPage.
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
