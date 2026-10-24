// The push record's keychain item (KP18): ONE expo-secure-store item, written through the app's key
// registry with keychainAccessible AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY and named in its index;
// clear removes the item and its entry; a wipe of every listed key leaves no record; a corrupt item
// reads as none and is deleted; and, read from the source, no other file of the wave imports
// expo-secure-store and the store never imports MMKV.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { KEYCHAIN_OPTIONS, THIS_DEVICE_ONLY } from '../../lib/__tests__/fake-secure-store';
import { SECURE_KEY_INDEX } from '../../lib/secure-keys';
import { PUSH_RECORD_ITEM } from '../config';
import { holding, keychain, storedRecord } from './registration-fixtures';
import { importsOf, sources } from './source-files';

// The native module, replaced: key-store.ts wires the app's registry over it.
const native = vi.hoisted(() => ({
  items: new Map<string, string>(),
  options: [] as unknown[],
  THIS_DEVICE_ONLY: 7,
}));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: native.THIS_DEVICE_ONLY,
  getItemAsync: async (key: string) => native.items.get(key) ?? null,
  setItemAsync: async (key: string, value: string, options: unknown) => {
    native.options.push(options);
    native.items.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    native.items.delete(key);
  },
}));

const { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } = await import('expo-secure-store');
const { createPushKeyStore, pushKeyStore } = await import('../registration/key-store');

const PUSH_DIR = path.resolve(__dirname, '..');
const listed = (items: Map<string, string>): unknown =>
  JSON.parse(items.get(SECURE_KEY_INDEX) ?? '[]');

describe('the push key store (KP18)', () => {
  it('saves ONE item, this phone only, named in the key index first', async () => {
    const { secure, store } = keychain();
    await store.save(storedRecord());
    expect(secure.calls.filter((call) => call.op === 'set')).toEqual([
      { op: 'set', key: SECURE_KEY_INDEX, options: KEYCHAIN_OPTIONS },
      { op: 'set', key: PUSH_RECORD_ITEM, options: KEYCHAIN_OPTIONS },
    ]);
    expect(KEYCHAIN_OPTIONS.keychainAccessible).toBe(THIS_DEVICE_ONLY);
    expect(listed(secure.items)).toEqual([PUSH_RECORD_ITEM]);
    expect(JSON.parse(secure.items.get(PUSH_RECORD_ITEM) ?? '{}')).toEqual(storedRecord());
    expect(await store.load()).toEqual(storedRecord());
  });

  it("the app's store writes through the app's registry with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY", async () => {
    await pushKeyStore.save(storedRecord());
    expect(native.options).toEqual([
      { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
      { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    ]);
    expect(listed(native.items)).toEqual([PUSH_RECORD_ITEM]);
    await pushKeyStore.clear();
    expect(native.items.has(PUSH_RECORD_ITEM)).toBe(false);
    expect(listed(native.items)).toEqual([]);
  });

  it('clear removes the item and its index entry', async () => {
    const { secure, store } = keychain();
    await store.save(storedRecord());
    await store.clear();
    expect(secure.items.has(PUSH_RECORD_ITEM)).toBe(false);
    expect(listed(secure.items)).toEqual([]);
    expect(await store.load()).toBeNull();
  });

  it('a registry wipe of every listed key leaves no push record', async () => {
    const { secure, registry, store } = keychain();
    await store.save(storedRecord());
    expect(await registry.keys()).toContain(PUSH_RECORD_ITEM);
    await registry.wipe();
    expect(secure.items.size).toBe(0);
    expect(await store.load()).toBeNull();
  });

  it('a corrupt item reads as none and is deleted', async () => {
    for (const raw of ['not json', JSON.stringify({ ...storedRecord(), pushKey: '' }), '[]']) {
      const { secure, store } = keychain({ [PUSH_RECORD_ITEM]: raw });
      expect(await store.load()).toBeNull();
      expect(secure.items.has(PUSH_RECORD_ITEM)).toBe(false);
    }
  });

  it('a keychain that refuses the read throws and deletes nothing', async () => {
    const { secure, store } = keychain(holding(storedRecord()));
    secure.failOn('get', PUSH_RECORD_ITEM);
    await expect(store.load()).rejects.toThrow();
    expect(secure.items.has(PUSH_RECORD_ITEM)).toBe(true);
  });

  it('refuses a weaker keychain class and a record that would not read back, naming no value', async () => {
    const weak = keychain();
    const store = createPushKeyStore({ keys: weak.registry, deviceOnly: false });
    await expect(store.save(storedRecord())).rejects.toThrow('this phone only');
    const { secure, store: strict } = keychain();
    const error = await strict
      .save({ ...storedRecord(), expoToken: 'not-a-token' })
      .catch((e) => e);
    expect(String(error)).toContain('expoToken');
    expect(String(error)).not.toContain('not-a-token');
    expect(String(error)).not.toContain(storedRecord().pushKey);
    expect(weak.secure.items.size + secure.items.size).toBe(0);
  });

  it('runs one call at a time: a load after a save reads what it wrote', async () => {
    const { store } = keychain();
    const [, loaded] = await Promise.all([store.save(storedRecord()), store.load()]);
    expect(loaded).toEqual(storedRecord());
  });
});

describe('read from the source (KP18)', () => {
  const STEP_UP_DIR = path.resolve(PUSH_DIR, '../step-up');
  const wave = [
    ...sources(PUSH_DIR),
    ...(existsSync(STEP_UP_DIR) ? sources(STEP_UP_DIR) : []),
  ].filter(({ file }) => !file.includes(`${path.sep}__tests__${path.sep}`));

  it('only registration/key-store.ts imports expo-secure-store', () => {
    const importers = wave
      .filter(({ text }) => importsOf(text, /^expo-secure-store$/).length > 0)
      .map(({ file }) => path.relative(PUSH_DIR, file));
    expect(importers).toEqual([path.join('registration', 'key-store.ts')]);
  });

  it('the key store never imports MMKV', () => {
    const store = wave.find(({ file }) => file.endsWith(path.join('registration', 'key-store.ts')));
    expect(store).toBeDefined();
    expect(importsOf(store?.text ?? '', /mmkv/i)).toEqual([]);
  });
});
