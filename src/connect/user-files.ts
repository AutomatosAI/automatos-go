// The person's files in the app's cache, deleted by every way of leaving (switch.ts's files port,
// KR9): the Deliverable viewer's copies (src/cc/deliverables/open-file.ts) and the workspace
// theme's downloaded fonts and mascot files (src/styles/themes/files.ts). Each clearer logs a
// failure and never throws, so the keychain step after it still runs. Downloads still running are
// stopped before anything is deleted. A new folder of the person's files under the cache is added
// here.

import { stopDownloads } from '../api/transfer';
import { clearViewerFiles } from '../cc/deliverables/open-file';
import { clearThemeFiles } from '../styles/themes/files';

/** Each folder's clearer, in the order they run. */
export const USER_FILE_CLEARERS: readonly (() => void)[] = Object.freeze([
  clearViewerFiles,
  clearThemeFiles,
]);

/**
 * Every download still running is stopped first (src/api/transfer.ts stopDownloads): none of them
 * can place a file once the folders are gone, even one whose body ends after this returns.
 */
export function clearUserFiles(): void {
  stopDownloads();
  USER_FILE_CLEARERS.forEach((clear) => clear());
}
