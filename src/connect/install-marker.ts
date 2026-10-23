// The reinstall wipe (KC9, release audit 20 Oct): iOS keeps keychain items after the app is deleted,
// so a new install would find the last one's paired record (with its device token) and Clerk's
// client JWT. The app's files ARE deleted with it, so a marker in a small MMKV file of its own says
// "this install has run before". At launch, before anything reads the keychain (the root layout
// holds ClerkProvider and the encrypted store back until this is done, src/session/InstallGate.tsx),
// a missing marker means a new install: the app's key registry (src/lib/secure-keys.ts) deletes
// EVERY item it lists (the paired record, Clerk's items, the encrypted store's key, later waves'
// keys), the paired record once more by name (an unreadable index lists nothing), then the marker
// is written. The install id is the one survivor: it lives outside the
// registry by design (install-id.ts).
//
// The marker is not in the encrypted store: that store's key is itself a registry item, which this
// wipe and every sign-out delete, and a marker sealed under a deleted key is lost with it at the
// next launch, which would then wipe again (signing the phone out, or forgetting a server paired
// since). A marker that cannot be read, or a keychain that refuses (locked before the first
// unlock), deletes nothing and writes no marker: the next launch checks again. Pure over its ports.

import type { KeyValueStorage } from '../storage/encrypted-storage';
import type { SecureKeyRegistry } from '../lib/secure-keys';
import { logger } from '../lib/logger';
import { INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE, PAIRED_RECORD_ITEM } from './config';

export type InstallCheck =
  /** The marker was there: this install has run before. */
  | 'known'
  /** A new install: every registered keychain item was deleted, then the marker written. */
  | 'wiped'
  /** The marker or the keychain could not be used: nothing deleted, checked again next launch. */
  | 'unchecked';

export type InstallMarkerDeps = {
  /** Opens the marker's own MMKV file (deleted with the app). */
  readonly openMarker: () => Pick<KeyValueStorage, 'getItem' | 'setItem'>;
  readonly keys: Pick<SecureKeyRegistry, 'wipe' | 'remove'>;
};

type MarkerFile = Pick<KeyValueStorage, 'getItem' | 'setItem'>;

/** The opened file and whether it holds the marker; null when it cannot be read. */
function readMarker(open: InstallMarkerDeps['openMarker']): {
  readonly file: MarkerFile;
  readonly present: boolean;
} | null {
  try {
    const file = open();
    return { file, present: file.getItem(INSTALL_MARKER_KEY) === INSTALL_MARKER_VALUE };
  } catch (error) {
    logger.warn('[connect] the install marker is unreadable; the reinstall check waits', error);
    return null;
  }
}

/** Runs once at launch, before anything reads the keychain. Never throws. */
export async function checkInstall({ openMarker, keys }: InstallMarkerDeps): Promise<InstallCheck> {
  const marker = readMarker(openMarker);
  if (!marker) return 'unchecked';
  if (marker.present) return 'known';
  try {
    // the registry reads its index before it deletes anything: a locked keychain throws first
    await keys.wipe();
    await keys.remove(PAIRED_RECORD_ITEM);
    marker.file.setItem(INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE);
    return 'wiped';
  } catch (error) {
    logger.warn('[connect] the reinstall wipe did not finish; it runs again next launch', error);
    return 'unchecked';
  }
}
