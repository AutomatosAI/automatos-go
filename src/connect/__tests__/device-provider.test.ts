import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { routes } from '../../api/routes';
import { fakeTransport, jsonReply, reply } from '../../api/__tests__/fake-transport';
import {
  bindDeviceProvider,
  createDeviceProvider,
  createRefusalSource,
} from '../../auth/providers/device';
import { createExpirySignal } from '../../auth/providers/expiry';
import { isRegisteredMode, PROVIDER_FACTORIES } from '../../auth/providers/registry';
import { selectProvider } from '../../auth/select';
import { AUTH_COPY } from '../../auth/strings';
import { memoryStorage } from '../../storage/encrypted-storage';
import { INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE, PAIRED_RECORD_ITEM } from '../config';
import type { DeviceStore, PairedRecord } from '../device-store';
import { classifyDeviceRefusal, refusalMessage, type DeviceRefusal } from '../expiry';
import { checkInstall } from '../install-marker';
import { CLERK_CLIENT_ITEM, OTHER_RECORD, RECORD, TOKEN } from './paired-record';

// device-store.ts wires the app's keychain; these tests pass a store over a fake one instead.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const { createDeviceStore } = await import('../device-store');
const { keychainWith } = await import('./paired-record');

function pairedStore(record: PairedRecord | null = RECORD) {
  const initial: Record<string, string> = record
    ? { [PAIRED_RECORD_ITEM]: JSON.stringify(record) }
    : {};
  const { store: keychain, registry } = keychainWith(initial);
  return { keychain, store: createDeviceStore({ keys: registry, deviceOnly: true }) };
}

/** A store whose calls can be counted (createDeviceStore's object is frozen). */
function counted(inner: DeviceStore) {
  const clear = vi.fn(() => inner.clear());
  return { store: { load: () => inner.load(), save: inner.save, clear }, clear };
}

const unauthorized = (code?: string) =>
  new ApiError('auth', { status: 401, ...(code ? { code } : {}) });

/** Lets the provider's refusal handling (keychain calls) finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the device provider (D-AUTH-PROVIDER, KC15)', () => {
  it('implements the AuthProvider interface exactly, kind device', () => {
    const provider = createDeviceProvider({
      store: pairedStore().store,
      expiry: createExpirySignal(),
      refusals: createRefusalSource(),
    });
    expect(provider.kind).toBe('device');
    expect(Object.keys(provider).sort()).toEqual(['getToken', 'kind', 'onExpired', 'signOut']);
  });

  it('getToken reads the keychain once, then memory', async () => {
    const { keychain, store } = pairedStore();
    const { provider } = bindDeviceProvider({ store });
    expect(await provider.getToken()).toBe(TOKEN);
    expect(await provider.getToken()).toBe(TOKEN);
    const reads = keychain.calls.filter((call) => call.key === PAIRED_RECORD_ITEM);
    expect(reads).toEqual([expect.objectContaining({ op: 'get' })]);
  });

  it('getToken is null when the phone is not paired', async () => {
    const { provider } = bindDeviceProvider({ store: pairedStore(null).store });
    expect(await provider.getToken()).toBeNull();
  });

  it('a keychain that refuses the read fails getToken (no call goes out without its token)', async () => {
    const { keychain, store } = pairedStore();
    keychain.failOn('get', PAIRED_RECORD_ITEM);
    const { provider } = bindDeviceProvider({ store });
    await expect(provider.getToken()).rejects.toThrow('keychain get failed');
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(true);
  });

  it('serves only its own pairing: once the phone pairs elsewhere it gives no token', async () => {
    const { store } = pairedStore();
    const { provider } = bindDeviceProvider({ store });
    expect(await provider.getToken()).toBe(TOKEN);
    await store.save(OTHER_RECORD);
    expect(await provider.getToken()).toBeNull();
    expect(await bindDeviceProvider({ store }).provider.getToken()).toBe(OTHER_RECORD.token);
  });

  it('signOut forgets the record on this phone', async () => {
    const { keychain, store } = pairedStore();
    const { provider } = bindDeviceProvider({ store });
    await provider.signOut();
    expect(await provider.getToken()).toBeNull();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });

  it('onExpired returns an unsubscribe', async () => {
    const { provider, clientAuth } = bindDeviceProvider({ store: pairedStore().store });
    await provider.getToken();
    const listener = vi.fn();
    const stop = provider.onExpired(listener);
    stop();
    clientAuth.onAuthExpired(unauthorized());
    await vi.waitFor(async () => expect(await provider.getToken()).toBeNull());
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('a 401 ends the pairing once (US-006 AC4)', () => {
  it('three concurrent 401s: cleared once, listeners notified once, the reason kept', async () => {
    const paired = counted(pairedStore().store);
    const refusals: DeviceRefusal[] = [];
    const { provider, clientAuth } = bindDeviceProvider({
      store: paired.store,
      onRefused: (refusal) => refusals.push(refusal),
    });
    expect(await provider.getToken()).toBe(TOKEN);
    const listener = vi.fn();
    provider.onExpired(listener);
    const revoked = unauthorized('device_revoked');
    clientAuth.onAuthExpired(revoked);
    clientAuth.onAuthExpired(revoked);
    clientAuth.onAuthExpired(revoked);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(paired.clear).toHaveBeenCalledTimes(1);
    expect(refusals).toEqual([
      { reason: 'revoked', serverName: RECORD.serverName, origin: RECORD.origin },
    ]);
    clientAuth.onAuthExpired(revoked); // a late answer to a call made before
    await settled();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(paired.clear).toHaveBeenCalledTimes(1);
  });

  it('through the one client: three calls answered 401 device_revoked', async () => {
    const paired = counted(pairedStore().store);
    const { provider, clientAuth } = bindDeviceProvider({ store: paired.store });
    const listener = vi.fn();
    provider.onExpired(listener);
    const transport = fakeTransport(() => jsonReply(401, { detail: { code: 'device_revoked' } }));
    const client = createApiClient({
      server: { apiUrl: RECORD.origin, webUrl: RECORD.webUrl, source: 'own' },
      getWorkspaceId: () => null,
      transport,
      ...clientAuth,
    });
    const calls = [1, 2, 3].map(() => client.request(routes.workspaceCurrent));
    const results = await Promise.allSettled(calls);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(paired.clear).toHaveBeenCalledTimes(1);
    expect(await provider.getToken()).toBeNull();
  });

  it("a refusal for another server's pairing clears nothing", async () => {
    const { store } = pairedStore();
    const stale = bindDeviceProvider({ store });
    await stale.provider.getToken();
    await store.save(OTHER_RECORD);
    const listener = vi.fn();
    stale.provider.onExpired(listener);
    stale.clientAuth.onAuthExpired(unauthorized());
    await settled();
    expect(await store.load()).toEqual(OTHER_RECORD);
    expect(listener).not.toHaveBeenCalled();
  });

  it('pairing again to the same device row is a new pairing: the old provider leaves it be', async () => {
    const { store } = pairedStore();
    const old = bindDeviceProvider({ store });
    expect(await old.provider.getToken()).toBe(TOKEN);
    // the server keeps the row (same device id) and mints a new token
    const again = { ...RECORD, token: OTHER_RECORD.token, pairedAt: '2026-10-22T09:00:00.000Z' };
    await store.save(again);
    expect(await old.provider.getToken()).toBeNull();
    old.clientAuth.onAuthExpired(unauthorized('device_revoked')); // a late answer to the old token
    await settled();
    expect(await store.load()).toEqual(again);
  });

  it('a late 401 while a new pairing is still being written leaves the new pairing', async () => {
    const { store } = pairedStore();
    const old = bindDeviceProvider({ store });
    expect(await old.provider.getToken()).toBe(TOKEN);
    const saving = store.save(OTHER_RECORD);
    old.clientAuth.onAuthExpired(unauthorized('device_revoked'));
    await saving;
    await settled();
    expect(await store.load()).toEqual(OTHER_RECORD);
  });

  it("a 401 before this pairing's token went out on a call clears nothing", async () => {
    const paired = counted(pairedStore().store);
    const { provider, clientAuth } = bindDeviceProvider({ store: paired.store });
    const listener = vi.fn();
    provider.onExpired(listener);
    clientAuth.onAuthExpired(unauthorized());
    await settled();
    expect(paired.clear).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(await provider.getToken()).toBe(TOKEN);
  });

  it('a keychain that cannot delete the record still ends the pairing for this launch', async () => {
    const { keychain, store } = pairedStore();
    const { provider, clientAuth } = bindDeviceProvider({ store });
    expect(await provider.getToken()).toBe(TOKEN);
    keychain.failOn('delete', PAIRED_RECORD_ITEM);
    const listener = vi.fn();
    provider.onExpired(listener);
    clientAuth.onAuthExpired(unauthorized());
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(await provider.getToken()).toBeNull();
  });

  it('a refusal listener that throws never stops the expiry listeners', async () => {
    const { provider, clientAuth } = bindDeviceProvider({
      store: pairedStore().store,
      onRefused: () => {
        throw new Error('listener bug');
      },
    });
    await provider.getToken();
    const listener = vi.fn();
    provider.onExpired(listener);
    clientAuth.onAuthExpired(unauthorized());
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
  });

  it("createDeviceProvider hears the client's 401s through its refusal source", async () => {
    const paired = counted(pairedStore().store);
    const refusals = createRefusalSource();
    const reasons: string[] = [];
    const provider = createDeviceProvider({
      store: paired.store,
      expiry: createExpirySignal(),
      refusals,
      onRefused: ({ reason }) => reasons.push(reason),
    });
    const listener = vi.fn();
    provider.onExpired(listener);
    await provider.getToken();
    refusals.notify(unauthorized('device_pairing_required'));
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(paired.clear).toHaveBeenCalledTimes(1);
    expect(reasons).toEqual(['pairing_required']);
  });
});

describe('the paired record behind the provider (fake keychain, fake MMKV)', () => {
  it('save, load and clear: what is saved is the token, signOut clears it', async () => {
    const { keychain, store } = pairedStore(null);
    await store.save(RECORD);
    expect(await store.load()).toEqual(RECORD);
    const { provider } = bindDeviceProvider({ store });
    expect(await provider.getToken()).toBe(TOKEN);
    await provider.signOut();
    expect(await store.load()).toBeNull();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });

  it('a corrupt item is deleted and the phone reads as not paired', async () => {
    const { store: keychain, registry } = keychainWith({ [PAIRED_RECORD_ITEM]: '{"origin":' });
    const store = createDeviceStore({ keys: registry, deviceOnly: true });
    expect(await bindDeviceProvider({ store }).provider.getToken()).toBeNull();
    expect(keychain.items.has(PAIRED_RECORD_ITEM)).toBe(false);
  });

  it("the reinstall wipe: a record without this install's marker never gives a token", async () => {
    const { store: keychain, registry } = keychainWith({
      [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD),
      [CLERK_CLIENT_ITEM]: 'old.clerk.jwt',
    });
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('wiped');
    const store = createDeviceStore({ keys: registry, deviceOnly: true });
    expect(await bindDeviceProvider({ store }).provider.getToken()).toBeNull();
    expect([...keychain.items.keys()]).toEqual([]);
    expect(marker.getItem(INSTALL_MARKER_KEY)).toBe(INSTALL_MARKER_VALUE);
  });

  it('an install that has run before keeps its pairing', async () => {
    const { registry } = keychainWith({ [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD) });
    const marker = memoryStorage();
    marker.setItem(INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE);
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('known');
    const store = createDeviceStore({ keys: registry, deviceOnly: true });
    expect(await bindDeviceProvider({ store }).provider.getToken()).toBe(TOKEN);
  });
});

describe('classifyDeviceRefusal (W1 core/auth/device.py, bearer_registry.py)', () => {
  it.each([
    ['device_revoked', 'revoked'],
    ['device_pairing_required', 'pairing_required'],
    ['invalid_pairing_code', 'ended'],
    [undefined, 'ended'],
  ] as const)('a 401 with code %s is %s', (code, reason) => {
    expect(classifyDeviceRefusal(unauthorized(code))).toBe(reason);
  });

  it('anything but a 401 ApiError is ended', () => {
    expect(
      classifyDeviceRefusal(new ApiError('forbidden', { status: 403, code: 'device_revoked' })),
    ).toBe('ended');
    expect(classifyDeviceRefusal(new Error('device_revoked'))).toBe('ended');
    expect(classifyDeviceRefusal(undefined)).toBe('ended');
  });

  it('the words name the server and say how to pair again', () => {
    const refusal = { serverName: 'Home NAS', origin: RECORD.origin };
    expect(refusalMessage({ ...refusal, reason: 'revoked' })).toBe(
      'This phone was removed from Home NAS. Pair it again from Studio → Settings → Phones & devices.',
    );
    for (const reason of ['pairing_required', 'ended'] as const) {
      const message = refusalMessage({ ...refusal, reason });
      expect(message).toContain('Home NAS');
      expect(message).toContain('Studio → Settings → Phones & devices');
    }
  });

  it('the client hands the 401 its ApiError, code included', async () => {
    const onAuthExpired = vi.fn();
    const client = createApiClient({
      server: { apiUrl: RECORD.origin, webUrl: RECORD.webUrl, source: 'own' },
      getToken: async () => TOKEN,
      getWorkspaceId: () => null,
      transport: fakeTransport(() => reply(401, '{"detail": {"code": "device_revoked"}}')),
      onAuthExpired,
    });
    await client.request(routes.workspaceCurrent).catch(() => undefined);
    expect(classifyDeviceRefusal(onAuthExpired.mock.calls[0]?.[0])).toBe('revoked');
  });
});

describe('the registry matrix (KC15)', () => {
  const select = (modes: readonly string[]) => selectProvider({ auth: { modes, clerk: null } });
  const unsupported = { unsupported: true, message: AUTH_COPY.unsupportedServer };

  it.each([
    [['clerk'], { unsupported: false, mode: 'clerk' }],
    [['device'], { unsupported: false, mode: 'device' }],
    [['oidc'], unsupported],
    [['saml-next'], unsupported],
    [[], unsupported],
  ] as const)('auth.modes %j → %j', (modes, selection) => {
    expect(select(modes)).toEqual(selection);
  });

  it("registers 'device' with createDeviceProvider; 'oidc' stays unregistered", () => {
    expect(PROVIDER_FACTORIES.device).toBe(createDeviceProvider);
    expect(isRegisteredMode('device')).toBe(true);
    expect(isRegisteredMode('oidc')).toBe(false);
  });
});
