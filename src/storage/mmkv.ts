// The app's one encrypted MMKV store, wired to the native modules: expo-crypto for the key's random
// bytes, expo-secure-store for the keychain item that holds it, react-native-mmkv for the file. The
// logic and its tests live in encrypted-storage.ts; tests never import this module. Opened lazily,
// on the first read, so importing it costs nothing and a background launch does not touch the
// keychain until something needs storage.

import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';

import {
  openEncryptedStorage,
  type KeyValueStorage,
  type OpenedStorage,
  type SecureKeyStore,
} from './encrypted-storage';

const MMKV_ID = 'automatos-go';

/** This phone only (no iCloud Keychain, no backup restore onto another device), after first unlock. */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = Object.freeze({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

const keychain: SecureKeyStore = Object.freeze({
  getItem: (key: string) => SecureStore.getItem(key, KEYCHAIN_OPTIONS),
  setItem: (key: string, value: string) => SecureStore.setItem(key, value, KEYCHAIN_OPTIONS),
});

let opened: OpenedStorage | null = null;

function open(): OpenedStorage {
  return openEncryptedStorage({
    secureStore: keychain,
    randomBytes: getRandomBytes,
    openMmkv: (encryptionKey) =>
      createMMKV({
        id: MMKV_ID,
        encryptionKey,
        encryptionType: 'AES-256',
        // a file the key cannot read (a new key after a keychain wipe) is a lost cache, not a crash
        recoveryStrategy: 'discard-on-error',
      }),
  });
}

/** The store: the encrypted MMKV file, or memory for this launch when the keychain is unavailable. */
export function appStorage(): KeyValueStorage {
  opened ??= open();
  return opened.storage;
}

/** false when this launch fell back to memory (nothing will be there next launch). */
export function isStoragePersistent(): boolean {
  opened ??= open();
  return opened.persistent;
}
