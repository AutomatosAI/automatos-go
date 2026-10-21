import { describe, expect, it, vi } from 'vitest';

import {
  STORAGE_KEY_BYTES,
  STORAGE_KEY_ITEM,
  encodeKey,
  isUsableKey,
  loadOrCreateKey,
  memoryStorage,
  openEncryptedStorage,
  type EncryptedStorageDeps,
  type MmkvLike,
  type SecureKeyStore,
} from '../encrypted-storage';

/** AES-256 in MMKV takes at most 32 bytes (react-native-mmkv cpp/HybridMMKV.cpp). */
const MMKV_AES256_MAX_KEY_BYTES = 32;

function fakeSecureStore(initial: Record<string, string> = {}): SecureKeyStore & {
  readonly items: Map<string, string>;
} {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function fakeMmkv(): MmkvLike & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getString: (key) => items.get(key),
    set: (key, value) => {
      items.set(key, value);
    },
    remove: (key) => items.delete(key),
  };
}

function sequentialBytes(seed: number) {
  return (count: number) => Uint8Array.from({ length: count }, (_, index) => (seed + index) % 256);
}

function deps(overrides: Partial<EncryptedStorageDeps> = {}) {
  const mmkv = fakeMmkv();
  const openMmkv = vi.fn((_key: string) => mmkv);
  return {
    mmkv,
    openMmkv,
    deps: {
      secureStore: fakeSecureStore(),
      randomBytes: sequentialBytes(7),
      openMmkv,
      ...overrides,
    } satisfies EncryptedStorageDeps,
  };
}

describe('the storage key', () => {
  it('is 24 random bytes as 32 base64 characters: within AES-256 and fully random', () => {
    const key = encodeKey(sequentialBytes(200)(STORAGE_KEY_BYTES));
    expect(key).toHaveLength(32);
    expect(new TextEncoder().encode(key).length).toBeLessThanOrEqual(MMKV_AES256_MAX_KEY_BYTES);
    expect(isUsableKey(key)).toBe(true);
  });

  it('refuses a byte count that would weaken or overflow the key', () => {
    expect(() => encodeKey(new Uint8Array(16))).toThrow(RangeError);
    expect(() => encodeKey(new Uint8Array(32))).toThrow(RangeError);
  });

  it('is generated once and then read back from the keychain', () => {
    const secureStore = fakeSecureStore();
    const randomBytes = vi.fn(sequentialBytes(1));
    const first = loadOrCreateKey({ secureStore, randomBytes });
    const second = loadOrCreateKey({ secureStore, randomBytes });
    expect(second).toBe(first);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(randomBytes).toHaveBeenCalledWith(STORAGE_KEY_BYTES);
    expect(secureStore.items.get(STORAGE_KEY_ITEM)).toBe(first);
  });

  it('replaces a malformed keychain item with a new key', () => {
    const secureStore = fakeSecureStore({ [STORAGE_KEY_ITEM]: 'short' });
    const key = loadOrCreateKey({ secureStore, randomBytes: sequentialBytes(3) });
    expect(isUsableKey(key)).toBe(true);
    expect(secureStore.items.get(STORAGE_KEY_ITEM)).toBe(key);
  });
});

describe('openEncryptedStorage', () => {
  it('opens MMKV with the keychain key and reads and writes through it', () => {
    const { deps: d, mmkv, openMmkv } = deps();
    const opened = openEncryptedStorage(d);
    expect(opened.persistent).toBe(true);
    expect(openMmkv).toHaveBeenCalledWith(d.secureStore.getItem(STORAGE_KEY_ITEM));

    opened.storage.setItem('theme', 'dark');
    expect(mmkv.items.get('theme')).toBe('dark');
    expect(opened.storage.getItem('theme')).toBe('dark');
    opened.storage.removeItem('theme');
    expect(opened.storage.getItem('theme')).toBeNull();
  });

  it('keeps the launch in memory when the keychain cannot be read, and writes no new key', () => {
    const setItem = vi.fn();
    const secureStore: SecureKeyStore = {
      getItem: () => {
        throw new Error('User interaction is not allowed.');
      },
      setItem,
    };
    const { deps: d, openMmkv } = deps({ secureStore });
    const opened = openEncryptedStorage(d);
    expect(opened.persistent).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(openMmkv).not.toHaveBeenCalled();
    opened.storage.setItem('k', 'v');
    expect(opened.storage.getItem('k')).toBe('v');
  });

  it('never opens a file under a key it could not save', () => {
    const secureStore: SecureKeyStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('keychain write failed');
      },
    };
    const { deps: d, openMmkv } = deps({ secureStore });
    expect(openEncryptedStorage(d).persistent).toBe(false);
    expect(openMmkv).not.toHaveBeenCalled();
  });

  it('falls back to memory, never to an unencrypted file, when MMKV refuses to open', () => {
    const openMmkv = vi.fn((): MmkvLike => {
      throw new Error('Failed to create MMKV instance!');
    });
    const opened = openEncryptedStorage({ ...deps().deps, openMmkv });
    expect(opened.persistent).toBe(false);
    expect(openMmkv).toHaveBeenCalledTimes(1);
  });
});

describe('memoryStorage', () => {
  it('is empty at the start and forgets on remove', () => {
    const storage = memoryStorage();
    expect(storage.getItem('k')).toBeNull();
    storage.setItem('k', 'v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });
});
