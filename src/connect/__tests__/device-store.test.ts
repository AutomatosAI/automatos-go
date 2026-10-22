import { describe, expect, it, vi } from 'vitest';

import { KEYCHAIN_OPTIONS, THIS_DEVICE_ONLY } from '../../lib/__tests__/fake-secure-store';
import { SECURE_KEY_INDEX } from '../../lib/secure-keys';
import { PAIRED_RECORD_ITEM } from '../config';
import { keychainWith, OTHER_RECORD, RECORD, TOKEN } from './paired-record';

// The native module, replaced: device-store.ts wires the app's registry over it.
const native = vi.hoisted(() => ({ items: new Map<string, string>(), options: [] as unknown[] }));

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: async (key: string) => native.items.get(key) ?? null,
  setItemAsync: async (key: string, value: string, options: unknown) => {
    native.options.push(options);
    native.items.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    native.items.delete(key);
  },
}));

const { createDeviceStore, deviceStore } = await import('../device-store');

function storeWith(initial: Record<string, string> = {}, deviceOnly = true) {
  const { store, registry } = keychainWith(initial);
  return { keychain: store, devices: createDeviceStore({ keys: registry, deviceOnly }) };
}

const gets = (keychain: ReturnType<typeof storeWith>['keychain']) =>
  keychain.calls.filter((call) => call.op === 'get' && call.key === PAIRED_RECORD_ITEM).length;

describe('the device store (KC9)', () => {
  it('saves ONE item, this phone only, named in the key index first', async () => {
    const { keychain, devices } = storeWith();
    await devices.save(RECORD);
    const sets = keychain.calls.filter((call) => call.op === 'set');
    expect(sets).toEqual([
      { op: 'set', key: SECURE_KEY_INDEX, options: KEYCHAIN_OPTIONS },
      { op: 'set', key: PAIRED_RECORD_ITEM, options: KEYCHAIN_OPTIONS },
    ]);
    expect(KEYCHAIN_OPTIONS.keychainAccessible).toBe(THIS_DEVICE_ONLY);
    expect(JSON.parse(keychain.items.get(SECURE_KEY_INDEX) ?? '[]')).toEqual([PAIRED_RECORD_ITEM]);
    expect(JSON.parse(keychain.items.get(PAIRED_RECORD_ITEM) ?? '{}')).toEqual(RECORD);
  });

  it('loads what was saved, from memory without another keychain read', async () => {
    const { keychain, devices } = storeWith();
    await devices.save(RECORD);
    expect(await devices.load()).toEqual(RECORD);
    expect(gets(keychain)).toBe(0);
  });

  it('reads the keychain once per launch; overlapping loads share the read', async () => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    const [first, second] = await Promise.all([devices.load(), devices.load()]);
    expect(first).toEqual(RECORD);
    expect(second).toEqual(RECORD);
    expect(await devices.load()).toEqual(RECORD);
    expect(gets(keychain)).toBe(1);
  });

  it('no item reads as none', async () => {
    expect(await storeWith().devices.load()).toBeNull();
  });

  it('clear forgets it at once and deletes the item and its index entry', async () => {
    const { keychain, devices } = storeWith();
    await devices.save(RECORD);
    await devices.clear();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
    expect(JSON.parse(keychain.items.get(SECURE_KEY_INDEX) ?? '[]')).toEqual([]);
    expect(await devices.load()).toBeNull();
    expect(gets(keychain)).toBe(0);
  });

  it('a failed delete still forgets the record for this launch', async () => {
    const { keychain, devices } = storeWith();
    await devices.save(RECORD);
    keychain.failOn('delete', PAIRED_RECORD_ITEM);
    await expect(devices.clear()).rejects.toThrow('keychain delete failed');
    expect(await devices.load()).toBeNull();
  });

  it.each([
    ['not JSON', '{not json'],
    ['not a record', JSON.stringify({ origin: RECORD.origin })],
    ['not a device token', JSON.stringify({ ...RECORD, token: 'clerk.jwt.token' })],
    ['http to a public host', JSON.stringify({ ...RECORD, origin: 'http://example.com' })],
    ['an origin with a path', JSON.stringify({ ...RECORD, origin: `${RECORD.origin}/api` })],
    ['a wrong unencrypted flag', JSON.stringify({ ...RECORD, insecure: false })],
    ['a web url that is not http(s)', JSON.stringify({ ...RECORD, webUrl: 'javascript:alert(1)' })],
  ])('a corrupt item (%s) is deleted and reads as none', async (_, raw) => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: raw });
    expect(await devices.load()).toBeNull();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });

  it('a corrupt item that cannot be deleted still reads as none', async () => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: '{not json' });
    keychain.failOn('delete', PAIRED_RECORD_ITEM);
    expect(await devices.load()).toBeNull();
  });

  it('a keychain that refuses the read throws and deletes nothing (before the first unlock)', async () => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    keychain.failOn('get', PAIRED_RECORD_ITEM);
    await expect(devices.load()).rejects.toThrow('keychain get failed');
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(true);
  });

  it('refuses to save under a keychain class that is not this phone only', async () => {
    const { keychain, devices } = storeWith({}, false);
    await expect(devices.save(RECORD)).rejects.toThrow('this phone only');
    expect(keychain.calls).toEqual([]);
  });

  it('refuses a record that would not read back, without the token in the message', async () => {
    const { keychain, devices } = storeWith();
    const bad = { ...RECORD, deviceId: 'not-a-uuid', origin: 'http://example.com' };
    const failure = await devices.save(bad).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toMatch(/deviceId/);
    expect(String(failure)).not.toContain(TOKEN);
    expect(keychain.calls).toEqual([]);
  });

  it('a save during a read wins over what the read finds', async () => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    const reading = devices.load();
    await devices.save(OTHER_RECORD);
    expect(await reading).toEqual(OTHER_RECORD);
    expect(await devices.load()).toEqual(OTHER_RECORD);
    expect(keychain.items.get(PAIRED_RECORD_ITEM)).toBe(JSON.stringify(OTHER_RECORD));
  });

  it('a clear while a save is still writing wins, in memory and in the keychain', async () => {
    const { keychain, devices } = storeWith();
    const saving = devices.save(RECORD);
    const clearing = devices.clear();
    await Promise.all([saving, clearing]);
    expect(await devices.load()).toBeNull();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });

  it('a load during a save answers what the save leaves', async () => {
    const { devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    expect(await devices.load()).toEqual(RECORD);
    const saving = devices.save(OTHER_RECORD);
    expect(await devices.load()).toEqual(OTHER_RECORD);
    await saving;
  });

  it('a load during a save that fails answers the record still there', async () => {
    const { keychain, devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    expect(await devices.load()).toEqual(RECORD);
    keychain.failOn('set', PAIRED_RECORD_ITEM);
    const saving = devices.save(OTHER_RECORD).catch((error: unknown) => error);
    expect(await devices.load()).toEqual(RECORD);
    expect(await saving).toBeInstanceOf(Error);
  });

  it('a clear during a read wins: the read never brings the record back', async () => {
    const { devices } = storeWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    const reading = devices.load();
    await devices.clear();
    expect(await reading).toBeNull();
    expect(await devices.load()).toBeNull();
  });

  it("the app's store writes through the app's registry with the native this-phone-only class", async () => {
    await deviceStore.save(RECORD);
    expect(native.items.get(PAIRED_RECORD_ITEM)).toBe(JSON.stringify(RECORD));
    expect(native.options).toContainEqual({ keychainAccessible: 7 });
    expect(
      native.options.every((options) => JSON.stringify(options) === '{"keychainAccessible":7}'),
    ).toBe(true);
    await deviceStore.clear();
    expect(native.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });
});
