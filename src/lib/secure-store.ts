// The keychain, wired to expo-secure-store: the one place the app's keychain options are set and the
// app's one secure-key registry (secure-keys.ts) is made. Every item is this phone only (no iCloud
// Keychain, no restore onto another device) and readable after the first unlock, so a background
// launch can still read it. The logic and its tests live in secure-keys.ts; the wiring's test mocks
// expo-secure-store.

import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEY_ITEM } from '../storage/encrypted-storage';
import { createSecureKeyRegistry, type Keychain, type SecureKeyRegistry } from './secure-keys';

export const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = Object.freeze({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

/**
 * @clerk/expo's CLERK_CLIENT_JWT_KEY (dist/constants.js), the item its token cache is asked for.
 * The registry indexes it when written; listing it as fixed too means a wipe still finds it if the
 * index were ever lost.
 */
const CLERK_CLIENT_ITEM = '__clerk_client_jwt';

export const keychain: Keychain = Object.freeze({ store: SecureStore, options: KEYCHAIN_OPTIONS });

/** Lists the MMKV key (written by src/storage/mmkv.ts under a fixed name) and Clerk's client item. */
export const secureKeys: SecureKeyRegistry = createSecureKeyRegistry({
  ...keychain,
  fixedKeys: [STORAGE_KEY_ITEM, CLERK_CLIENT_ITEM],
});
