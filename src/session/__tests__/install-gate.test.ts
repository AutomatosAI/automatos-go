// The reinstall check runs before anything reads the keychain (KC9, lead 20 Oct): the gate stays
// shut until the wipe is done, the root layout mounts ClerkProvider (and the encrypted store) only
// inside it, so Clerk's token cache never sees the last install's client JWT. vitest runs no React
// Native renderer: the wiring is read from app/_layout.tsx's source.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createTokenCache } from '../../auth/token-cache';
import { CLERK_CLIENT_ITEM, keychainWith, RECORD } from '../../connect/__tests__/paired-record';
import { INSTALL_MARKER_STORE_ID, PAIRED_RECORD_ITEM } from '../../connect/config';
import { checkInstall, type InstallCheck } from '../../connect/install-marker';
import { SECURE_KEY_INDEX } from '../../lib/secure-keys';
import { memoryStorage } from '../../storage/encrypted-storage';

// The native modules, replaced: install-gate.ts wires them for the app.
const native = vi.hoisted(() => ({ configs: [] as unknown[] }));

vi.mock('react-native-mmkv', () => ({
  createMMKV: (config: unknown) => {
    native.configs.push(config);
    const items = new Map<string, string>();
    return {
      getString: (key: string) => items.get(key),
      set: (key: string, value: string) => items.set(key, value),
      remove: (key: string) => items.delete(key),
    };
  },
}));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const { createInstallGate, NATIVE_INSTALL_CHECK } = await import('../install-gate');
const { secureKeys } = await import('../../lib/secure-store');

const ROOT = path.resolve(__dirname, '../../..');
const ROOT_LAYOUT = readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');

function deferred() {
  let settle: (outcome: InstallCheck) => void = () => undefined;
  const promise = new Promise<InstallCheck>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

describe('the install gate', () => {
  it('stays shut until the check settles, and runs the check once', async () => {
    const pending = deferred();
    const check = vi.fn(() => pending.promise);
    const gate = createInstallGate(check);
    expect(gate.isReady()).toBe(false);
    const first = gate.ready();
    const second = gate.ready();
    await Promise.resolve();
    expect(gate.isReady()).toBe(false);
    pending.settle('wiped');
    expect(await first).toBe('wiped');
    expect(await second).toBe('wiped');
    expect(gate.isReady()).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('a check that throws still opens the gate, as unchecked', async () => {
    const gate = createInstallGate(() => Promise.reject(new Error('boom')));
    expect(await gate.ready()).toBe('unchecked');
    expect(gate.isReady()).toBe(true);
  });

  it("deletes the last install's items before Clerk's token cache reads any", async () => {
    const { store, registry } = keychainWith({
      [SECURE_KEY_INDEX]: JSON.stringify([PAIRED_RECORD_ITEM]),
      [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD),
      [CLERK_CLIENT_ITEM]: 'old.clerk.jwt',
    });
    const tokenCache = createTokenCache(registry);
    const gate = createInstallGate(() =>
      checkInstall({ openMarker: memoryStorage, keys: registry }),
    );
    // the root layout renders ClerkProvider (whose first act is this read) once the gate is open
    expect(gate.isReady()).toBe(false);
    await gate.ready();
    expect(await tokenCache.getToken(CLERK_CLIENT_ITEM)).toBeNull();

    const position = (op: string, key: string) =>
      store.calls.findIndex((call) => call.op === op && call.key === key);
    const lastDelete = store.calls.map((call) => call.op).lastIndexOf('delete');
    expect(position('delete', CLERK_CLIENT_ITEM)).toBeGreaterThanOrEqual(0);
    expect(position('delete', PAIRED_RECORD_ITEM)).toBeGreaterThanOrEqual(0);
    expect(position('get', CLERK_CLIENT_ITEM)).toBeGreaterThan(lastDelete);
  });

  it('the root layout mounts the theme, the cache and ClerkProvider only inside the gate', () => {
    const opens = ROOT_LAYOUT.indexOf('<InstallGate>');
    const closes = ROOT_LAYOUT.indexOf('</InstallGate>');
    expect(opens).toBeGreaterThan(0);
    for (const inside of ['ThemeProvider', 'QueryRoot', 'AuthRoot', 'Stack']) {
      expect(ROOT_LAYOUT.indexOf(`<${inside}`)).toBeGreaterThan(opens);
      expect(ROOT_LAYOUT.lastIndexOf(inside)).toBeLessThan(closes);
    }
  });

  it("the app's check opens the marker's own plain MMKV file and uses the app's registry", () => {
    NATIVE_INSTALL_CHECK.openMarker();
    expect(native.configs).toEqual([{ id: INSTALL_MARKER_STORE_ID }]);
    expect(NATIVE_INSTALL_CHECK.keys).toBe(secureKeys);
  });
});
