import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY_ITEM } from '../../storage/encrypted-storage';
import { SECURE_KEY_INDEX } from '../secure-keys';

// The native module, replaced: its constants are read from native code on a device.
const native = vi.hoisted(() => ({
  AFTER_FIRST_UNLOCK: 1,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 2,
  items: new Map<string, string>(),
  calls: [] as { op: string; key: string; options: unknown }[],
}));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: native.AFTER_FIRST_UNLOCK,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: native.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  getItemAsync: async (key: string, options: unknown) => {
    native.calls.push({ op: 'get', key, options });
    return native.items.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string, options: unknown) => {
    native.calls.push({ op: 'set', key, options });
    native.items.set(key, value);
  },
  deleteItemAsync: async (key: string, options: unknown) => {
    native.calls.push({ op: 'delete', key, options });
    native.items.delete(key);
  },
}));

const { KEYCHAIN_OPTIONS, keychain, secureKeys } = await import('../secure-store');

describe('the keychain wiring', () => {
  beforeEach(() => {
    native.items.clear();
    native.calls.length = 0;
  });

  it('writes this phone only, after first unlock (never the iCloud-synced AFTER_FIRST_UNLOCK)', () => {
    expect(KEYCHAIN_OPTIONS).toEqual({
      keychainAccessible: native.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    expect(keychain.options).toBe(KEYCHAIN_OPTIONS);
  });

  it("the app's registry writes the index and the item with those options", async () => {
    await secureKeys.write('automatos.push-key.v1', 'push');
    const writes = native.calls.filter((call) => call.op === 'set');
    expect(writes).toEqual([
      { op: 'set', key: SECURE_KEY_INDEX, options: KEYCHAIN_OPTIONS },
      { op: 'set', key: 'automatos.push-key.v1', options: KEYCHAIN_OPTIONS },
    ]);
  });

  it("lists the MMKV key and Clerk's client item even before anything is indexed", async () => {
    const keys = await secureKeys.keys();
    expect(keys.slice(0, 2)).toEqual([STORAGE_KEY_ITEM, '__clerk_client_jwt']);
  });
});
