// Every keychain item the app writes (KR9, R10): ONE list, with whose it is and what clears it. iOS
// keeps keychain items after the app is deleted, so the first launch of a new install deletes every
// item here but the install id (src/connect/install-marker.ts, through the registry's wipe), and
// leaving a session deletes every item that is the person's (clearUserKeys, run by the provider's
// sign-out and by src/connect/switch.ts clearUserData). Each key's name is written here and only
// here: the owners import it (src/release/__tests__/secure-store-audit.test.ts keeps it so). Items
// with a key chosen at runtime (Clerk asks its token cache for its own keys) go through the key
// registry (src/lib/secure-keys.ts), which names each one in the index item before it is written,
// so they can be listed and cleared too. Every item is written with a THIS_DEVICE_ONLY class
// (src/lib/secure-store.ts KEYCHAIN_OPTIONS). Pure: no native module, so vitest loads it.

import type { SecureKeyRegistry } from '../lib/secure-keys';

/** The one item that names every item written through the key registry. */
export const SECURE_KEY_INDEX = 'automatos.secure-keys.v1';
/** The encrypted MMKV store's AES-256 key. */
export const STORAGE_KEY_ITEM = 'automatos.storage.mmkv-key.v1';
/** @clerk/expo's CLERK_CLIENT_JWT_KEY (dist/constants.js), the item its token cache is asked for. */
export const CLERK_CLIENT_ITEM = '__clerk_client_jwt';
/** The paired record: the own server, the device id and its token. */
export const PAIRED_RECORD_ITEM = 'automatos.paired-server.v1';
/** The push record: the row's device id and the key that checks a notification is genuine. */
export const PUSH_RECORD_ITEM = 'automatos.push-record.v1';
/** This install's random id (POST /pair and push registration). */
export const INSTALL_ID_ITEM = 'automatos.install-id.v1';

export type SecureKeyEntry = Readonly<{
  key: string;
  /** The repo file that reads and writes it. */
  owner: string;
  /** Deleted when the person signs out, forgets the server or removes this phone. */
  userBound: boolean;
  /** Kept by the first launch after a reinstall. */
  survivesReinstall: boolean;
  reason: string;
}>;

export const SECURE_KEYS: readonly SecureKeyEntry[] = Object.freeze([
  {
    key: SECURE_KEY_INDEX,
    owner: 'src/lib/secure-keys.ts',
    userBound: false,
    survivesReinstall: false,
    reason:
      'Key names only. Sign-out deletes the items it names and drops them from it; a reinstall deletes it.',
  },
  {
    key: STORAGE_KEY_ITEM,
    owner: 'src/storage/encrypted-storage.ts',
    userBound: false,
    survivesReinstall: false,
    reason:
      "The phone's own key for the encrypted store, not the person's: sign-out deletes the person's entries from the store instead, and the key too when the store was not emptied. The store's file goes with the app, so a reinstall deletes the key too.",
  },
  {
    key: CLERK_CLIENT_ITEM,
    owner: 'src/auth/token-cache.ts',
    userBound: true,
    survivesReinstall: false,
    reason: "The hosted sign-in (Clerk's client token); any other key Clerk asks for is indexed.",
  },
  {
    key: PAIRED_RECORD_ITEM,
    owner: 'src/connect/device-store.ts',
    userBound: true,
    survivesReinstall: false,
    reason: "The pairing with an own server: its device token signs this phone's calls.",
  },
  {
    key: PUSH_RECORD_ITEM,
    owner: 'src/push/registration/key-store.ts',
    userBound: true,
    survivesReinstall: false,
    reason: "The push row's device id and the key that checks a notification is genuine.",
  },
  {
    key: INSTALL_ID_ITEM,
    owner: 'src/connect/install-id.ts',
    userBound: false,
    survivesReinstall: true,
    reason:
      'A random number with no personal data, so pairing again after a reinstall reuses the phone row in Studio (KC9).',
  },
]);

function keysWhere(test: (entry: SecureKeyEntry) => boolean): readonly string[] {
  return Object.freeze(SECURE_KEYS.filter(test).map((entry) => entry.key));
}

/**
 * What the key registry always lists, indexed or not (src/lib/secure-store.ts fixedKeys): every
 * item but the index itself and the reinstall's survivors, so a reinstall wipe finds each one by
 * name even when the index is lost.
 */
export const LISTED_KEYS: readonly string[] = keysWhere(
  (entry) => entry.key !== SECURE_KEY_INDEX && !entry.survivesReinstall,
);

/** The items leaving a session keeps: none of them is the person's. */
export const KEPT_AT_SIGN_OUT: readonly string[] = keysWhere((entry) => !entry.userBound);

/**
 * Deletes every item the registry lists that is the person's: the user-bound ones and every key
 * the index names (only Clerk's, the paired record and the push record are ever written through
 * it). Never the store's key, the index or the install id. Tries them all, then throws if any
 * failed; a failed one stays in the index, so the next sign-out or a reinstall deletes it.
 */
export async function clearUserKeys(
  registry: Pick<SecureKeyRegistry, 'keys' | 'remove'>,
): Promise<void> {
  const listed = await registry.keys();
  const doomed = listed.filter((key) => !KEPT_AT_SIGN_OUT.includes(key));
  const results = await Promise.allSettled(doomed.map((key) => registry.remove(key)));
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length === 0) return;
  throw new Error(`could not delete ${failures.length} keychain item(s)`, {
    cause: failures[0]?.reason,
  });
}
