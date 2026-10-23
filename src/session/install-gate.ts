// The launch's reinstall check (src/connect/install-marker.ts), run ONCE per launch and wired to the
// native modules: the marker's own MMKV file and the app's key registry. The root layout mounts
// nothing that reads the keychain or the encrypted store until it is done (InstallGate.tsx).

import { createMMKV } from 'react-native-mmkv';

import { INSTALL_MARKER_STORE_ID } from '../connect/config';
import { checkInstall, type InstallCheck, type InstallMarkerDeps } from '../connect/install-marker';
import { secureKeys } from '../lib/secure-store';
import { mmkvStorage } from '../storage/encrypted-storage';

export type InstallGate = {
  /** Starts the check on the first call; settles once it is done, whatever the outcome. */
  readonly ready: () => Promise<InstallCheck>;
  readonly isReady: () => boolean;
};

export function createInstallGate(check: () => Promise<InstallCheck>): InstallGate {
  let done = false;
  let running: Promise<InstallCheck> | undefined;
  return Object.freeze({
    ready: () => {
      running ??= check()
        .catch((): InstallCheck => 'unchecked')
        .then((outcome) => {
          done = true;
          return outcome;
        });
      return running;
    },
    isReady: () => done,
  });
}

/** The marker's file (plain: it holds one flag, no secret) and the app's one key registry. */
export const NATIVE_INSTALL_CHECK: InstallMarkerDeps = Object.freeze({
  openMarker: () => mmkvStorage(createMMKV({ id: INSTALL_MARKER_STORE_ID })),
  keys: secureKeys,
});

export const installGate: InstallGate = createInstallGate(() => checkInstall(NATIVE_INSTALL_CHECK));
