// A fake expo-secure-store (the async calls) for the keychain tests: it records every call with the
// options it was given and can be told to fail a call, so nothing imports the native module.

import type { AsyncSecureStore, SecureStoreOptions } from '../secure-keys';

/** Stands in for SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, read from the native module. */
export const THIS_DEVICE_ONLY = 7;
export const KEYCHAIN_OPTIONS: SecureStoreOptions = Object.freeze({
  keychainAccessible: THIS_DEVICE_ONLY,
});

export type StoreOp = 'get' | 'set' | 'delete';
export type StoreCall = {
  readonly op: StoreOp;
  readonly key: string;
  readonly options?: SecureStoreOptions;
};

export type FakeSecureStore = AsyncSecureStore & {
  readonly items: Map<string, string>;
  readonly calls: StoreCall[];
  /** The next and every later `op` on `key` rejects. */
  readonly failOn: (op: StoreOp, key: string) => void;
};

export function fakeSecureStore(initial: Record<string, string> = {}): FakeSecureStore {
  const items = new Map(Object.entries(initial));
  const calls: StoreCall[] = [];
  const failing = new Set<string>();
  const call = (op: StoreOp, key: string, options?: SecureStoreOptions) => {
    calls.push({ op, key, options });
    if (failing.has(`${op}:${key}`)) throw new Error(`keychain ${op} failed`);
  };
  return {
    items,
    calls,
    failOn: (op, key) => {
      failing.add(`${op}:${key}`);
    },
    getItemAsync: async (key, options) => {
      call('get', key, options);
      return items.get(key) ?? null;
    },
    setItemAsync: async (key, value, options) => {
      call('set', key, options);
      items.set(key, value);
    },
    deleteItemAsync: async (key, options) => {
      call('delete', key, options);
      items.delete(key);
    },
  };
}
