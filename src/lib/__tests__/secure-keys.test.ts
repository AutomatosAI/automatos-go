import { describe, expect, it } from 'vitest';

import { SECURE_KEY_INDEX, createSecureKeyRegistry, isSecureKey } from '../secure-keys';
import { KEYCHAIN_OPTIONS, fakeSecureStore, type FakeSecureStore } from './fake-secure-store';

const MMKV_KEY = 'automatos.storage.mmkv-key.v1';
const CLERK_KEY = '__clerk_client_jwt';

function registryOver(store: FakeSecureStore, fixedKeys: readonly string[] = [MMKV_KEY]) {
  return createSecureKeyRegistry({ store, options: KEYCHAIN_OPTIONS, fixedKeys });
}

function indexOf(store: FakeSecureStore): unknown {
  const raw = store.items.get(SECURE_KEY_INDEX);
  return raw === undefined ? undefined : JSON.parse(raw);
}

describe('writing through the registry', () => {
  it('names each key in ONE index item, then writes the item, all with the keychain options', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'jwt');
    await registry.write('automatos.push-key.v1', 'push');
    expect(indexOf(store)).toEqual([CLERK_KEY, 'automatos.push-key.v1']);
    const writes = store.calls.filter((call) => call.op === 'set');
    expect(writes.map((call) => call.key)).toEqual([
      SECURE_KEY_INDEX,
      CLERK_KEY,
      SECURE_KEY_INDEX,
      'automatos.push-key.v1',
    ]);
    expect(writes.every((call) => call.options === KEYCHAIN_OPTIONS)).toBe(true);
  });

  it('indexes a key once however often its item is written', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'one');
    await registry.write(CLERK_KEY, 'two');
    expect(indexOf(store)).toEqual([CLERK_KEY]);
    expect(store.items.get(CLERK_KEY)).toBe('two');
    expect(
      store.calls.filter((call) => call.key === SECURE_KEY_INDEX && call.op === 'set'),
    ).toHaveLength(1);
  });

  it('loses no key when writes run at the same time', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    const keys = ['a.one', 'b.two', 'c.three', 'd.four'];
    await Promise.all(keys.map((key) => registry.write(key, key)));
    expect(indexOf(store)).toEqual(keys);
  });

  it('never leaves an item outside the index when a remove and a write race', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store, []);
    await registry.write(CLERK_KEY, 'old');
    // Clerk can clear its item and save a new one straight after, without waiting
    const removing = registry.remove(CLERK_KEY);
    const writing = registry.write(CLERK_KEY, 'new');
    await Promise.all([removing, writing]);
    expect(store.items.get(CLERK_KEY)).toBe('new');
    expect(indexOf(store)).toEqual([CLERK_KEY]);
  });

  it('writes no item it could not first name in the index', async () => {
    const store = fakeSecureStore();
    store.failOn('set', SECURE_KEY_INDEX);
    await expect(registryOver(store).write(CLERK_KEY, 'jwt')).rejects.toThrow();
    expect(store.items.has(CLERK_KEY)).toBe(false);
  });

  it('continues an index written by an earlier launch', async () => {
    const store = fakeSecureStore({ [SECURE_KEY_INDEX]: JSON.stringify([CLERK_KEY]) });
    await registryOver(store).write('automatos.device-token.v1', 'token');
    expect(indexOf(store)).toEqual([CLERK_KEY, 'automatos.device-token.v1']);
  });

  it.each(['not json', '{"keys":[]}', '["bad key!"]'])(
    'starts a new index over an unreadable one (%s)',
    async (raw) => {
      const store = fakeSecureStore({ [SECURE_KEY_INDEX]: raw });
      const registry = registryOver(store, []);
      expect(await registry.keys()).toEqual([]);
      await registry.write(CLERK_KEY, 'jwt');
      expect(indexOf(store)).toEqual([CLERK_KEY]);
    },
  );

  it('refuses a key expo-secure-store would refuse, before touching the keychain', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    await expect(registry.write('has space', 'x')).rejects.toThrow(RangeError);
    await expect(registry.remove('a/b')).rejects.toThrow(RangeError);
    await expect(registry.read('a:b')).rejects.toThrow(RangeError);
    expect(store.calls).toEqual([]);
    expect(isSecureKey(CLERK_KEY)).toBe(true);
  });

  it('reads an item with the keychain options', async () => {
    const store = fakeSecureStore({ [CLERK_KEY]: 'jwt' });
    expect(await registryOver(store).read(CLERK_KEY)).toBe('jwt');
    expect(store.calls[0]).toEqual({ op: 'get', key: CLERK_KEY, options: KEYCHAIN_OPTIONS });
  });
});

describe('removing through the registry', () => {
  it('deletes the item, then drops its key from the index', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'jwt');
    await registry.write('b.two', 'x');
    await registry.remove(CLERK_KEY);
    await registry.remove('never.written');
    expect(store.items.has(CLERK_KEY)).toBe(false);
    expect(indexOf(store)).toEqual(['b.two']);
    const deleted = store.calls.find((call) => call.op === 'delete');
    expect(deleted?.options).toBe(KEYCHAIN_OPTIONS);
  });

  it('keeps the key listed when the delete fails', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store, []);
    await registry.write(CLERK_KEY, 'jwt');
    store.failOn('delete', CLERK_KEY);
    await expect(registry.remove(CLERK_KEY)).rejects.toThrow();
    expect(await registry.keys()).toEqual([CLERK_KEY]);
  });
});

describe('listing and wiping every key', () => {
  it('lists the fixed keys and the indexed ones, each once', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'jwt');
    await registry.write(MMKV_KEY, 'k');
    expect(await registry.keys()).toEqual([MMKV_KEY, CLERK_KEY]);
  });

  it('wipe deletes every listed item and the index, with the keychain options', async () => {
    const store = fakeSecureStore({ [MMKV_KEY]: 'k', unrelated: 'x' });
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'jwt');
    await registry.wipe();
    expect([...store.items.keys()]).toEqual(['unrelated']);
    const deletes = store.calls.filter((call) => call.op === 'delete');
    expect(deletes.map((call) => call.key).sort()).toEqual(
      [CLERK_KEY, MMKV_KEY, SECURE_KEY_INDEX].sort(),
    );
    expect(deletes.every((call) => call.options === KEYCHAIN_OPTIONS)).toBe(true);
    expect(await registry.keys()).toEqual([MMKV_KEY]);
  });

  it('wipes what an earlier launch wrote (a fresh registry reads the index)', async () => {
    const store = fakeSecureStore({ [SECURE_KEY_INDEX]: JSON.stringify([CLERK_KEY]) });
    store.items.set(CLERK_KEY, 'jwt');
    await registryOver(store, []).wipe();
    expect(store.items.size).toBe(0);
  });

  it('tries every item, keeps the ones it could not delete listed, then throws', async () => {
    const store = fakeSecureStore({ [MMKV_KEY]: 'k' });
    const registry = registryOver(store);
    await registry.write(CLERK_KEY, 'jwt');
    await registry.write('b.two', 'x');
    store.failOn('delete', CLERK_KEY);
    await expect(registry.wipe()).rejects.toThrow('could not delete 1 keychain item(s)');
    expect(store.items.has('b.two')).toBe(false);
    expect(store.items.has(MMKV_KEY)).toBe(false);
    expect(indexOf(store)).toEqual([CLERK_KEY]);
  });

  it('keeps a failed fixed key out of the index (it is listed anyway)', async () => {
    const store = fakeSecureStore({ [MMKV_KEY]: 'k' });
    const registry = registryOver(store);
    store.failOn('delete', MMKV_KEY);
    await expect(registry.wipe()).rejects.toThrow();
    expect(indexOf(store)).toEqual([]);
    expect(await registry.keys()).toEqual([MMKV_KEY]);
  });

  it('a write queued behind a wipe is indexed again, so the next wipe finds it', async () => {
    const store = fakeSecureStore();
    const registry = registryOver(store, []);
    await registry.write(CLERK_KEY, 'jwt');
    const wiping = registry.wipe();
    const late = registry.write(CLERK_KEY, 'signed-out-client');
    await Promise.all([wiping, late]);
    expect(indexOf(store)).toEqual([CLERK_KEY]);
  });
});
