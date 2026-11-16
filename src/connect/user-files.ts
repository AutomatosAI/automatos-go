// The person's files in the app's cache, deleted by every way of leaving (switch.ts's files port,
// KR9): the Deliverable viewer's copies (src/cc/deliverables/open-file.ts) and the workspace
// theme's downloaded fonts and mascot files (src/styles/themes/files.ts). Each clearer logs a
// failure and never throws, so the keychain step after it still runs. A new folder of the
// person's files under the cache is added here.

import { clearViewerFiles } from '../cc/deliverables/open-file';
import { clearThemeFiles } from '../styles/themes/files';

/** Each folder's clearer, in the order they run. */
export const USER_FILE_CLEARERS: readonly (() => void)[] = Object.freeze([
  clearViewerFiles,
  clearThemeFiles,
]);

export function clearUserFiles(): void {
  USER_FILE_CLEARERS.forEach((clear) => clear());
}
