// R10 / KR9 as tests that keep running in CI: a deleted-and-reinstalled app starts signed out, and
// leaving a session leaves nothing of the person's on the phone. Over a fake expo-secure-store under
// the app's registry lists (src/storage/secure-registry.ts) and memory stores for the encrypted
// store and the install marker's file. (a) The first launch after a reinstall
// (src/connect/install-marker.ts) deletes every item but the install id, by name even when the
// index is lost, before Clerk's token cache, the device store or push read one. (b) The hosted
// Sign out and Forget this server run ONE clearUserData (src/connect/switch.ts): push first, the
// provider while its items are still there, then the cache, every store entry but the phone's own
// choices and every keychain item of the person's; the store's key, the install id and the marker
// stay. src/release/__tests__/secure-store-audit.test.ts keeps every key in the registry.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { QUERY_CACHE_STORAGE_KEY } from '../../api/query-client';
import { createClerkProvider } from '../../auth/providers/clerk';
import { bindDeviceProvider } from '../../auth/providers/device';
import { createExpirySignal } from '../../auth/providers/expiry';
import { createTokenCache } from '../../auth/token-cache';
import { RECORD } from '../../connect/__tests__/paired-record';
import { INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE } from '../../connect/config';
import { createCurrentServerStore } from '../../connect/current-server';
import { createDeviceStore, type PairedRecord } from '../../connect/device-store';
import { checkInstall } from '../../connect/install-marker';
import { createServerSwitch, type ServerSwitchDeps } from '../../connect/switch';
import { createConsentStore } from '../../consent/store';
import { fakeSecureStore, KEYCHAIN_OPTIONS } from '../../lib/__tests__/fake-secure-store';
import type { AsyncSecureStore, SecureStoreOptions } from '../../lib/secure-keys';
import { HANDLED_KEYS_ITEM } from '../../push/config';
import { createPushKeyStore } from '../../push/registration/key-store';
import { createWorkspaceIdRegistry } from '../../session/workspace-ids';
import { memoryStorage } from '../../storage/encrypted-storage';
import {
  CLERK_CLIENT_ITEM,
  INSTALL_ID_ITEM,
  LISTED_KEYS,
  PAIRED_RECORD_ITEM,
  PUSH_RECORD_ITEM,
  SECURE_KEY_INDEX,
  SECURE_KEYS,
  STORAGE_KEY_ITEM,
} from '../../storage/secure-registry';
import {
  CLERK_INDEXED_ITEM,
  INSTALL_ID,
  PHONE_ENTRIES,
  keychainOf,
  leftovers,
  usedPhone,
} from './support/phone';

const native = vi.hoisted(() => ({
  store: null as AsyncSecureStore | null,
  order: [] as string[],
}));

// the app's wiring (src/lib/secure-store.ts) over whichever fake keychain a test sets
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: (key: string, options?: SecureStoreOptions) =>
    native.store?.getItemAsync(key, options),
  setItemAsync: (key: string, value: string, options?: SecureStoreOptions) =>
    native.store?.setItemAsync(key, value, options),
  deleteItemAsync: (key: string, options?: SecureStoreOptions) =>
    native.store?.deleteItemAsync(key, options),
}));

// push's leave (US-014i) is its own wave's, tested there: here only when it runs
vi.mock('../../push/bind/before-leaving', () => ({
  clearPushBeforeLeaving: async () => void native.order.push('push'),
}));

const KEPT_KEYCHAIN = [INSTALL_ID_ITEM, SECURE_KEY_INDEX, STORAGE_KEY_ITEM].sort();
const USER_BOUND = SECURE_KEYS.filter((entry) => entry.userBound).map((entry) => entry.key);
const ROOT = path.resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

afterEach(() => {
  native.order.length = 0;
});

/** A last install's keychain: every registry item, Clerk's indexed one too. */
function lastInstall(index: string) {
  return keychainOf({
    [SECURE_KEY_INDEX]: index,
    [CLERK_CLIENT_ITEM]: 'old.client.jwt',
    [CLERK_INDEXED_ITEM]: 'old.db.jwt',
    [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD),
    [PUSH_RECORD_ITEM]: '{"push":"old"}',
  });
}

describe('(a) the first launch after a reinstall', () => {
  it("the app's registry lists every item but the index and the install id, written this phone only", async () => {
    native.store = fakeSecureStore();
    const { KEYCHAIN_OPTIONS: options, secureKeys } = await import('../../lib/secure-store');
    expect(await secureKeys.keys()).toEqual(LISTED_KEYS);
    expect(LISTED_KEYS).not.toContain(INSTALL_ID_ITEM);
    expect(options).toEqual({ keychainAccessible: 7 });
  });

  it('deletes every item but the install id, the indexed ones too, then writes the marker', async () => {
    const { secure, registry } = lastInstall(
      JSON.stringify([CLERK_INDEXED_ITEM, PUSH_RECORD_ITEM]),
    );
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('wiped');
    expect([...secure.items.keys()]).toEqual([INSTALL_ID_ITEM]);
    expect(secure.items.get(INSTALL_ID_ITEM)).toBe(INSTALL_ID);
    expect(marker.getItem(INSTALL_MARKER_KEY)).toBe(INSTALL_MARKER_VALUE);
  });

  it("an unreadable index still loses every registry item, by name (the push record's key too)", async () => {
    const { secure, registry } = lastInstall('{not json');
    secure.items.delete(CLERK_INDEXED_ITEM);
    expect(await checkInstall({ openMarker: memoryStorage, keys: registry })).toBe('wiped');
    expect([...secure.items.keys()]).toEqual([INSTALL_ID_ITEM]);
  });

  it('runs before the first read: Clerk, the device store and push read only after the last delete', async () => {
    const { secure, registry } = lastInstall(JSON.stringify([CLERK_INDEXED_ITEM]));
    await checkInstall({ openMarker: memoryStorage, keys: registry });
    const lastDelete = secure.calls.map((call) => call.op).lastIndexOf('delete');
    expect(await createTokenCache(registry).getToken(CLERK_CLIENT_ITEM)).toBeNull();
    expect(await createDeviceStore({ keys: registry, deviceOnly: true }).load()).toBeNull();
    expect(await createPushKeyStore({ keys: registry, deviceOnly: true }).load()).toBeNull();
    const reads = secure.calls
      .map((call, position) => ({ ...call, position }))
      .filter((call) => call.op === 'get' && USER_BOUND.includes(call.key));
    expect(reads.map((call) => call.key)).toEqual([
      CLERK_CLIENT_ITEM,
      PAIRED_RECORD_ITEM,
      PUSH_RECORD_ITEM,
    ]);
    reads.forEach((call) => expect(call.position, call.key).toBeGreaterThan(lastDelete));
  });

  it('the root layout mounts the sign-in root inside the gate, and push only under it', () => {
    const root = read('app/_layout.tsx');
    expect(root.indexOf('<AuthRoot>')).toBeGreaterThan(root.indexOf('<InstallGate>'));
    expect(root.indexOf('<Stack')).toBeLessThan(root.indexOf('</InstallGate>'));
    expect(read('app/(app)/_layout.tsx')).toContain('<PushRoot');
    expect(root).not.toContain('PushRoot');
  });
});

type Phone = Awaited<ReturnType<typeof usedPhone>>;

/** The app's switch over the phone; the provider is the session being left. */
async function switchOver(
  phone: Phone,
  provider: ServerSwitchDeps['provider'],
  paired: PairedRecord | null,
  storage: ServerSwitchDeps['storage'] = () => phone.storage,
) {
  const servers = createCurrentServerStore();
  await servers.load({ load: async () => paired });
  const consent = createConsentStore({ storage: () => phone.storage });
  const deviceStore = createDeviceStore({ keys: phone.registry, deviceOnly: true });
  if (paired) await deviceStore.save(paired);
  const serverSwitch = createServerSwitch({
    queryClient: phone.queryClient,
    persister: phone.persister,
    workspaceIds: createWorkspaceIdRegistry(),
    provider,
    consent: { resetMemory: () => undefined, forgetServer: consent.forgetServer },
    keys: phone.registry,
    storage,
    files: () => void native.order.push('files'),
    deviceStore,
    servers,
  });
  return { serverSwitch, servers, deviceStore };
}

/** Clerk's port: its sign-out notes whether its client item was still there. */
function hostedProvider(phone: Phone, signOut?: () => Promise<void>) {
  const clerkSignOut = async () => {
    native.order.push(`clerk (item there: ${phone.secure.items.has(CLERK_CLIENT_ITEM)})`);
    await signOut?.();
  };
  return createClerkProvider(
    { getToken: async () => 'session.jwt', signOut: clerkSignOut },
    { expiry: createExpirySignal(), secureKeys: phone.registry },
  );
}

const SIGNED_OUT = {
  keychain: KEPT_KEYCHAIN,
  store: [...PHONE_ENTRIES].sort(),
  cache: false,
  marker: INSTALL_MARKER_VALUE,
};

describe('(b) leaving: one clearUserData', () => {
  it("hosted Sign out: push first, Clerk with its item, then every item of the person's goes", async () => {
    const phone = await usedPhone();
    const { serverSwitch } = await switchOver(phone, hostedProvider(phone), null);
    await serverSwitch.signOut();
    expect(native.order).toEqual(['push', 'clerk (item there: true)', 'files']);
    expect(leftovers(phone)).toEqual(SIGNED_OUT);
    expect(phone.secure.items.get(SECURE_KEY_INDEX)).toBe('[]');
    expect(phone.secure.items.get(INSTALL_ID_ITEM)).toBe(INSTALL_ID);
    expect(phone.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('Forget this server: the same, the paired record too, and the phone moves to hosted', async () => {
    const phone = await usedPhone(RECORD.deviceId);
    const { provider } = bindDeviceProvider({
      store: createDeviceStore({ keys: phone.registry, deviceOnly: true }),
    });
    const { serverSwitch, servers } = await switchOver(phone, provider, RECORD);
    expect(phone.secure.items.has(PAIRED_RECORD_ITEM)).toBe(true);
    await serverSwitch.forgetServer();
    expect(native.order).toEqual(['push', 'files']);
    expect(leftovers(phone)).toEqual(SIGNED_OUT);
    expect(servers.getSnapshot()).toEqual({ status: 'ready', own: null, ended: null });
  });

  it("writes every item this phone only, and never deletes the install id or the store's key", async () => {
    const phone = await usedPhone();
    const { serverSwitch } = await switchOver(phone, hostedProvider(phone), null);
    await serverSwitch.signOut();
    const sets = phone.secure.calls.filter((call) => call.op === 'set');
    sets.forEach((call) => expect(call.options, call.key).toBe(KEYCHAIN_OPTIONS));
    const deleted = phone.secure.calls
      .filter((call) => call.op === 'delete')
      .map((call) => call.key);
    expect(deleted).not.toContain(INSTALL_ID_ITEM);
    expect(deleted).not.toContain(STORAGE_KEY_ITEM);
  });

  it("a sign-out Clerk refuses (offline) deletes nothing of the person's but the cache", async () => {
    const phone = await usedPhone();
    const before = leftovers(phone);
    const offline = hostedProvider(phone, async () => Promise.reject(new Error('offline')));
    const { serverSwitch } = await switchOver(phone, offline, null);
    await expect(serverSwitch.signOut()).rejects.toThrow();
    expect(native.order).toEqual(['push', 'clerk (item there: true)']);
    const store = before.store.filter((key) => key !== QUERY_CACHE_STORAGE_KEY);
    expect(leftovers(phone)).toEqual({ ...before, store, cache: false });
  });

  it('a session the server ended (expired): the same clearing, push left to its own leave', async () => {
    const phone = await usedPhone();
    const { serverSwitch } = await switchOver(phone, hostedProvider(phone), null);
    await serverSwitch.endSession();
    expect(native.order).toEqual(['clerk (item there: true)', 'files']);
    expect(leftovers(phone)).toEqual(SIGNED_OUT);
  });

  it('a store entry that will not delete fails the sign-out, after the keychain is cleared', async () => {
    const phone = await usedPhone();
    const failing = () => ({
      keys: phone.storage.keys,
      removeItem: (key: string) => {
        if (key === HANDLED_KEYS_ITEM) throw new Error('mmkv');
        phone.storage.removeItem(key);
      },
    });
    const { serverSwitch } = await switchOver(phone, hostedProvider(phone), null, failing);
    await expect(serverSwitch.signOut()).rejects.toThrow('could not delete 1 encrypted store');
    expect(native.order).toEqual(['push', 'clerk (item there: true)', 'files']);
    expect(leftovers(phone).keychain).toEqual(KEPT_KEYCHAIN);
    expect(leftovers(phone).store).toEqual([HANDLED_KEYS_ITEM, ...PHONE_ENTRIES].sort());
  });

  it('every way out runs it: Sign out, Forget this server, Remove this phone and an ended session', () => {
    const signOut = read('src/app-state/use-sign-out.ts');
    expect(signOut).toContain('const leaving = own ? forgetServer() : leaveHosted();');
    expect(signOut).toContain('endSession().catch(');
    expect(signOut).not.toContain('provider.signOut()');
    const wiring = read('src/connect/use-server-switch.ts');
    expect(wiring).toContain('forget: serverSwitch.forgetServer,');
    expect(wiring).toContain('keys: secureKeys,');
    expect(wiring).toContain('storage: appStorage,');
    expect(wiring).toContain('files: clearViewerFiles,');
  });
});
