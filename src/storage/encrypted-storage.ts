// The phone's key-value store (D-CACHE): one MMKV file encrypted with AES-256 under a key that is
// generated once from secure random bytes and kept in the keychain (expo-secure-store), never in the
// file, the bundle or the logs. Pure over its ports (secure store, random bytes, the MMKV opener)
// so it runs in vitest; mmkv.ts wires the native modules. If the key cannot be read or saved (the
// keychain is locked before the first unlock, or fails), the store falls back to memory for this
// launch: nothing is written, and never to an unencrypted file.

import { logger } from '../lib/logger';
import { STORAGE_KEY_ITEM } from './secure-registry';

/** The synchronous storage the query persister and the theme choice use. */
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** The store with its keys listed, so leaving a session can empty it item by item (switch.ts). */
export type ListableStorage = KeyValueStorage & {
  keys(): readonly string[];
};

/** The keychain, as expo-secure-store's synchronous calls. */
export type SecureKeyStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** An MMKV instance's string calls (react-native-mmkv 4). */
export type MmkvLike = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
  getAllKeys(): string[];
};

export type EncryptedStorageDeps = {
  readonly secureStore: SecureKeyStore;
  readonly randomBytes: (count: number) => Uint8Array;
  /** Opens the MMKV file with this AES-256 key. */
  readonly openMmkv: (encryptionKey: string) => MmkvLike;
};

export type OpenedStorage = {
  readonly storage: ListableStorage;
  /** false when the store fell back to memory: nothing survives this launch. */
  readonly persistent: boolean;
};

/** The keychain item that holds the MMKV key (named in src/storage/secure-registry.ts). */
export { STORAGE_KEY_ITEM };

/**
 * 24 random bytes as base64 is 32 ASCII characters: exactly AES-256's 32-byte key limit in MMKV
 * (HybridMMKV.cpp throws above it), carrying 192 bits of entropy.
 */
export const STORAGE_KEY_BYTES = 24;
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9+/]{32}$/;

export function encodeKey(bytes: Uint8Array): string {
  if (bytes.length !== STORAGE_KEY_BYTES) {
    throw new RangeError(`expected ${STORAGE_KEY_BYTES} random bytes, got ${bytes.length}`);
  }
  return btoa(String.fromCharCode(...bytes));
}

export function isUsableKey(value: string | null): value is string {
  return value !== null && STORAGE_KEY_PATTERN.test(value);
}

/**
 * The stored key, or a new one saved before it is used. A missing or malformed item gets a new key
 * (the old file, if any, is then unreadable: it is a cache and MMKV discards it). A keychain that
 * throws gets no new key, so a locked keychain never replaces a good one.
 */
export function loadOrCreateKey(deps: Omit<EncryptedStorageDeps, 'openMmkv'>): string {
  const stored = deps.secureStore.getItem(STORAGE_KEY_ITEM);
  if (isUsableKey(stored)) return stored;
  const created = encodeKey(deps.randomBytes(STORAGE_KEY_BYTES));
  deps.secureStore.setItem(STORAGE_KEY_ITEM, created);
  return created;
}

export function mmkvStorage(mmkv: MmkvLike): ListableStorage {
  return Object.freeze({
    getItem: (key: string) => mmkv.getString(key) ?? null,
    setItem: (key: string, value: string) => mmkv.set(key, value),
    removeItem: (key: string) => {
      mmkv.remove(key);
    },
    keys: () => Object.freeze([...mmkv.getAllKeys()]),
  });
}

/** A store that lives only as long as this launch. */
export function memoryStorage(): ListableStorage {
  const items = new Map<string, string>();
  return Object.freeze({
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    keys: () => Object.freeze([...items.keys()]),
  });
}

export function openEncryptedStorage(deps: EncryptedStorageDeps): OpenedStorage {
  try {
    const mmkv = deps.openMmkv(loadOrCreateKey(deps));
    return Object.freeze({ storage: mmkvStorage(mmkv), persistent: true });
  } catch (error) {
    // the cause stays in the dev log: it names the keychain or MMKV failure, never the key
    logger.warn('[storage] encrypted storage unavailable; keeping this launch in memory', error);
    return Object.freeze({ storage: memoryStorage(), persistent: false });
  }
}
