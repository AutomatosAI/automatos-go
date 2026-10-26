// The keychain, wired to expo-secure-store: the one place the app's keychain options are set and the
// app's one secure-key registry (secure-keys.ts) is made. Every item is this phone only (no iCloud
// Keychain, no restore onto another device) and readable after the first unlock, so a background
// launch can still read it. The logic and its tests live in secure-keys.ts; the wiring's test mocks
// expo-secure-store.

import * as SecureStore from 'expo-secure-store';

import { LISTED_KEYS } from '../storage/secure-registry';
import { createSecureKeyRegistry, type Keychain, type SecureKeyRegistry } from './secure-keys';

export const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = Object.freeze({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

export const keychain: Keychain = Object.freeze({ store: SecureStore, options: KEYCHAIN_OPTIONS });

/**
 * Lists every item of src/storage/secure-registry.ts but the index and the install id, written
 * through the registry or not (the MMKV key, Clerk's client item, the paired and push records):
 * the registry indexes those written through it, and listing them as fixed too means a reinstall
 * wipe still finds each one by name if the index were ever lost.
 */
export const secureKeys: SecureKeyRegistry = createSecureKeyRegistry({
  ...keychain,
  fixedKeys: LISTED_KEYS,
});
