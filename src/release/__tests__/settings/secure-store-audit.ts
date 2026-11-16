// The keychain audit's lists (secure-store-audit.test.ts, R10, KR9): the files wired to the native
// module, the names the app's keychain options go by, the calls that pass on a key they were
// given, and the raw writes through a port whose adapter adds the options. Each with its reason.
// The registry file and the classes that never leave the phone are the audit's own.

import { frozen, reasoned } from './types';

/** The files that import expo-secure-store as a module. */
export const ADAPTER_FILES = reasoned(
  'The two files wired to the native module (the one keychain options object, the MMKV key).',
  ['src/lib/secure-store.ts', 'src/storage/mmkv.ts'],
);

/** The options a raw keychain write may pass. */
export const WRITE_OPTION_NAMES = reasoned(
  "The options a raw keychain write may pass: the app's KEYCHAIN_OPTIONS, under its names.",
  ['options', 'KEYCHAIN_OPTIONS', 'keychain.options', 'registry.options'],
);

export type Forwarder = Readonly<{ file: string; arg: string; reason: string }>;

/** Calls that pass on a key they were given; who gives it is audited here too. */
export const FORWARDERS: readonly Forwarder[] = frozen([
  {
    file: 'src/lib/secure-keys.ts',
    arg: 'key',
    reason: "The registry's own write, remove and wipe: the key its caller passed.",
  },
  {
    file: 'src/lib/secure-keys.ts',
    arg: 'checkedKey(key)',
    reason: "The registry's read: the caller's key, checked against expo-secure-store's rule.",
  },
  {
    file: 'src/storage/mmkv.ts',
    arg: 'key',
    reason: "The SecureKeyStore adapter: encrypted-storage.ts's STORAGE_KEY_ITEM.",
  },
  {
    file: 'src/auth/token-cache.ts',
    arg: 'key',
    reason: "Clerk's own key: the registry's write names it in the index before the item.",
  },
  {
    file: 'src/storage/secure-registry.ts',
    arg: 'key',
    reason: 'clearUserKeys deletes what the registry lists.',
  },
]);

export type PortWrite = Readonly<{ file: string; receiver: string; reason: string }>;

/** Raw keychain writes with no options: a port whose one adapter adds them. */
export const PORT_WRITES: readonly PortWrite[] = frozen([
  {
    file: 'src/storage/encrypted-storage.ts',
    receiver: 'deps.secureStore',
    reason: 'SecureKeyStore: its one adapter, src/storage/mmkv.ts, writes with KEYCHAIN_OPTIONS.',
  },
]);
