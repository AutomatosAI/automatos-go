import { describe, expect, it, vi } from 'vitest';

import {
  fakeSecureStore,
  KEYCHAIN_OPTIONS,
  THIS_DEVICE_ONLY,
} from '../../lib/__tests__/fake-secure-store';
import { SECURE_KEY_INDEX } from '../../lib/secure-keys';

// The native modules, replaced: install-id.ts wires them when no deps are passed.
const native = vi.hoisted(() => ({
  items: new Map<string, string>(),
  options: [] as unknown[],
  randomCalls: [] as number[],
}));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: async (key: string, options: unknown) => {
    native.options.push(options);
    return native.items.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string, options: unknown) => {
    native.options.push(options);
    native.items.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    native.items.delete(key);
  },
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (count: number) => {
    native.randomCalls.push(count);
    return Uint8Array.from({ length: count }, (_, index) => index);
  },
}));

const { base64url, getInstallId, INSTALL_ID_PATTERN } = await import('../install-id');
const { INSTALL_ID_BYTES, INSTALL_ID_ITEM } = await import('../config');

const SERVER_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

function counting(bytes = Uint8Array.from({ length: INSTALL_ID_BYTES }, (_, i) => 255 - i)) {
  const randomBytes = vi.fn(async (count: number) => bytes.slice(0, count));
  return randomBytes;
}

function depsWith(store = fakeSecureStore(), randomBytes = counting()) {
  return {
    store,
    randomBytes,
    deps: { keychain: { store, options: KEYCHAIN_OPTIONS }, randomBytes },
  };
}

describe('getInstallId (KC9)', () => {
  it('makes 16 random bytes into a 22-character base64url id the server accepts', async () => {
    const { deps, randomBytes } = depsWith();
    const id = await getInstallId(deps);
    expect(randomBytes).toHaveBeenCalledWith(16);
    expect(id).toHaveLength(22);
    expect(id).toMatch(SERVER_PATTERN);
    expect(INSTALL_ID_PATTERN.source).toBe(SERVER_PATTERN.source);
  });

  it('is made once and read back on every later call', async () => {
    const { deps, store, randomBytes } = depsWith();
    const first = await getInstallId(deps);
    const second = await getInstallId(deps);
    expect(second).toBe(first);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(store.items.get(INSTALL_ID_ITEM)).toBe(first);
  });

  it('overlapping first calls share one read and make one id', async () => {
    const { deps, store, randomBytes } = depsWith();
    const ids = await Promise.all([getInstallId(deps), getInstallId(deps), getInstallId(deps)]);
    expect(new Set(ids).size).toBe(1);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(store.calls.filter((call) => call.op === 'set')).toHaveLength(1);
  });

  it('reuses the id an earlier install left in the keychain (iOS keeps it)', async () => {
    const kept = 'kept-install_id-0123';
    const { deps, randomBytes } = depsWith(fakeSecureStore({ [INSTALL_ID_ITEM]: kept }));
    expect(await getInstallId(deps)).toBe(kept);
    expect(randomBytes).not.toHaveBeenCalled();
  });

  it('replaces a stored value the server would refuse', async () => {
    for (const bad of ['', 'short', 'has space in it', 'x'.repeat(129), 'ünïcödé-ünïcödé']) {
      const { deps, store } = depsWith(fakeSecureStore({ [INSTALL_ID_ITEM]: bad }));
      const id = await getInstallId(deps);
      expect(id).not.toBe(bad);
      expect(id).toMatch(SERVER_PATTERN);
      expect(store.items.get(INSTALL_ID_ITEM)).toBe(id);
    }
  });

  it('writes this phone only, after first unlock, and outside the key registry', async () => {
    const { deps, store } = depsWith();
    await getInstallId(deps);
    expect(store.calls.every((call) => call.options === KEYCHAIN_OPTIONS)).toBe(true);
    expect(KEYCHAIN_OPTIONS.keychainAccessible).toBe(THIS_DEVICE_ONLY);
    expect(store.items.has(SECURE_KEY_INDEX)).toBe(false);
  });

  it('throws when the keychain will not keep it, so nothing is sent to a server', async () => {
    const store = fakeSecureStore();
    store.failOn('set', INSTALL_ID_ITEM);
    await expect(getInstallId(depsWith(store).deps)).rejects.toThrow('keychain set failed');
    // the next call tries again rather than handing back the failed attempt
    expect(store.calls.filter((call) => call.op === 'get')).toHaveLength(1);
    await expect(getInstallId(depsWith(store).deps)).rejects.toThrow();
    expect(store.calls.filter((call) => call.op === 'get')).toHaveLength(2);
  });

  it('throws when the random source falls short', async () => {
    const { deps } = depsWith(fakeSecureStore(), counting(new Uint8Array(4)));
    await expect(getInstallId(deps)).rejects.toThrow(RangeError);
  });

  it("wires the app's keychain and expo-crypto when given no deps", async () => {
    const id = await getInstallId();
    expect(native.randomCalls).toEqual([INSTALL_ID_BYTES]);
    expect(native.items.get(INSTALL_ID_ITEM)).toBe(id);
    expect(native.options).toEqual([{ keychainAccessible: 7 }, { keychainAccessible: 7 }]);
    expect(await getInstallId()).toBe(id);
  });
});

describe('base64url (RFC 4648 §5, no padding)', () => {
  it.each([0, 1, 2, 3, 4, 5, 15, 16, 17, 32])('matches Node for %i bytes', (length) => {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 97 + 13) % 256);
    expect(base64url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
  });

  it('uses - and _ where base64 has + and /', () => {
    expect(base64url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe('-_-_');
  });
});
