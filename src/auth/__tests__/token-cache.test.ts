import { describe, expect, it } from 'vitest';

import {
  KEYCHAIN_OPTIONS,
  fakeSecureStore,
  type FakeSecureStore,
} from '../../lib/__tests__/fake-secure-store';
import { SECURE_KEY_INDEX, createSecureKeyRegistry } from '../../lib/secure-keys';
import { createTokenCache } from '../token-cache';

const CLERK_KEY = '__clerk_client_jwt';

function cacheOver(store: FakeSecureStore) {
  const registry = createSecureKeyRegistry({ store, options: KEYCHAIN_OPTIONS });
  return { registry, cache: createTokenCache(registry) };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function indexOf(store: FakeSecureStore): unknown {
  return JSON.parse(store.items.get(SECURE_KEY_INDEX) ?? 'null');
}

describe("Clerk's token cache over the keychain", () => {
  it('writes every item with the keychain options (this phone only, after first unlock)', async () => {
    const store = fakeSecureStore();
    const { cache } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt.one');
    await cache.saveToken('__clerk_other', 'client.jwt.two');
    expect(store.items.get(CLERK_KEY)).toBe('client.jwt.one');
    const writes = store.calls.filter((call) => call.op === 'set');
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((call) => call.options === KEYCHAIN_OPTIONS)).toBe(true);
  });

  it('records each key in the ONE index item, before the item itself is written', async () => {
    const store = fakeSecureStore();
    const { cache, registry } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt');
    await cache.saveToken(CLERK_KEY, 'client.jwt.refreshed');
    const writes = store.calls.filter((call) => call.op === 'set').map((call) => call.key);
    expect(writes).toEqual([SECURE_KEY_INDEX, CLERK_KEY, CLERK_KEY]);
    expect(indexOf(store)).toEqual([CLERK_KEY]);
    expect(await registry.keys()).toEqual([CLERK_KEY]);
  });

  it('reads an item back with the same options', async () => {
    const store = fakeSecureStore({ [CLERK_KEY]: 'client.jwt' });
    const { cache } = cacheOver(store);
    expect(await cache.getToken(CLERK_KEY)).toBe('client.jwt');
    expect(await cache.getToken('absent')).toBeNull();
    expect(store.calls.filter((call) => call.op === 'get')[0]?.options).toBe(KEYCHAIN_OPTIONS);
  });

  it('answers null when the keychain refuses a read, and deletes nothing', async () => {
    const store = fakeSecureStore({ [CLERK_KEY]: 'client.jwt' });
    store.failOn('get', CLERK_KEY);
    const { cache } = cacheOver(store);
    expect(await cache.getToken(CLERK_KEY)).toBeNull();
    expect(store.items.get(CLERK_KEY)).toBe('client.jwt');
    expect(store.calls.some((call) => call.op === 'delete')).toBe(false);
  });

  it("does not fail Clerk's request when the keychain refuses a write", async () => {
    const store = fakeSecureStore();
    store.failOn('set', CLERK_KEY);
    const { cache } = cacheOver(store);
    await expect(cache.saveToken(CLERK_KEY, 'client.jwt')).resolves.toBeUndefined();
    expect(store.items.has(CLERK_KEY)).toBe(false);
  });

  it('writes no item it could not first record in the index', async () => {
    const store = fakeSecureStore();
    store.failOn('set', SECURE_KEY_INDEX);
    const { cache } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt');
    expect(store.items.has(CLERK_KEY)).toBe(false);
  });

  it('clearToken deletes the item and drops it from the index', async () => {
    const store = fakeSecureStore();
    const { cache, registry } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt');
    cache.clearToken?.(CLERK_KEY);
    await settle();
    expect(store.items.has(CLERK_KEY)).toBe(false);
    expect(await registry.keys()).toEqual([]);
    const deleted = store.calls.find((call) => call.op === 'delete');
    expect(deleted?.options).toBe(KEYCHAIN_OPTIONS);
  });

  it('a clear followed at once by a save keeps the new item listed', async () => {
    const store = fakeSecureStore();
    const { cache } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt');
    cache.clearToken?.(CLERK_KEY);
    await cache.saveToken(CLERK_KEY, 'client.jwt.new');
    await settle();
    expect(store.items.get(CLERK_KEY)).toBe('client.jwt.new');
    expect(indexOf(store)).toEqual([CLERK_KEY]);
  });

  it('a failed clear leaves the key listed for the next wipe', async () => {
    const store = fakeSecureStore();
    const { cache, registry } = cacheOver(store);
    await cache.saveToken(CLERK_KEY, 'client.jwt');
    store.failOn('delete', CLERK_KEY);
    cache.clearToken?.(CLERK_KEY);
    await settle();
    expect(await registry.keys()).toEqual([CLERK_KEY]);
  });
});
