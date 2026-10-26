// Sign-out and Forget this server unregister the device and delete the key (US-014i, KP16, KP18,
// W2 US-009), over a fake SecureStore and the real key registry (its index), the real registrar and
// a fake client: hosted Sign out sends exactly one DELETE /api/v1/mobile/devices/{device_id}, then
// the push item leaves the keychain and the index, then signOut runs; offline, the DELETE fails and
// the rest still happens; Forget this server (with the connect kit's Remove this phone) leaves ONE
// DELETE, the connect kit's; a new pairing tears push down too; an own server's onExpired
// (device_revoked) deletes the record; a Clerk session expiry keeps it and clears only the badge and
// the delivered notifications. Logs carry kinds only.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTHORIZATION_HEADER, WORKSPACE_HEADER } from '../../api/auth-headers';
import { ApiError } from '../../api/errors';
import { fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { createClerkProvider } from '../../auth/providers/clerk';
import { bindDeviceProvider } from '../../auth/providers/device';
import { createExpirySignal } from '../../auth/providers/expiry';
import type { AuthProvider } from '../../auth/providers/types';
import { DEVICE_REVOKED } from '../../connect/config';
import { removeThisPhone } from '../../connect/remove-device';
import { RECORD } from '../../connect/__tests__/paired-record';
import { signOutAfterPush } from '../bind/before-leaving';
import { onSessionExpired, type ExpiryDeps } from '../bind/leave';
import { createPhoneLinkStore, phoneLinks } from '../settings/phone-link';
import { DEVICE_ID } from './data-fixtures';
import { spyOnLogger } from './handler-fixtures';
import { leavingPhone, serverSwitchOver } from './leave-fixtures';
import { KEY, ORIGIN, TOKEN, answering, offline, storedRecord } from './registration-fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const DELETE_ROUTE = `DELETE /api/v1/mobile/devices/${DEVICE_ID}`;
const SHOWN = ['badge:0', 'dismiss'];
const CLEARED = [...SHOWN, 'handled', 'prompt'];

/** The own server, paired at the push record's origin, its row the push record's row. */
const PAIRED = Object.freeze({ ...RECORD, origin: ORIGIN });
const OWN_RECORD = storedRecord({ deviceId: PAIRED.deviceId });
const OWN_DELETE = `DELETE ${ORIGIN}/api/v1/mobile/devices/${PAIRED.deviceId}`;

let detach: (() => void) | null = null;

afterEach(() => {
  detach?.();
  detach = null;
  vi.restoreAllMocks();
});

/** The app's one link carries this phone's leave, as PushRoot attaches it. */
function attached(phone: Awaited<ReturnType<typeof leavingPhone>>) {
  detach = phoneLinks.attach(phone.link);
}

describe('hosted Sign out: DELETE the row, then the push record goes, then signOut', () => {
  it('one DELETE with the still-valid Clerk token, the item and its index entry gone, then signOut', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({
      order,
      script: { revoke: [() => (order.push('DELETE'), jsonReply(200, {}))] },
    });
    const links = createPhoneLinkStore();
    links.attach(phone.link);
    expect([phone.kept(), phone.listed()]).toEqual([true, true]);
    let atSignOut: readonly boolean[] = [];
    await signOutAfterPush(() => {
      order.push('signOut');
      atSignOut = [phone.kept(), phone.listed()];
    }, links);
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE]);
    const [call] = phone.world.api.calls;
    expect(call?.headers[AUTHORIZATION_HEADER]).toBe('Bearer jwt.token.value');
    expect(call?.headers[WORKSPACE_HEADER]).toBeDefined();
    expect(order).toEqual(['DELETE', ...CLEARED, 'signOut']);
    expect(atSignOut).toEqual([false, false]);
  });

  it('offline: the DELETE fails, the item and its index entry still go, and signOut still runs', async () => {
    const lines = spyOnLogger();
    const phone = await leavingPhone({ script: { revoke: [offline] } });
    const links = createPhoneLinkStore();
    links.attach(phone.link);
    const signOut = vi.fn();
    await signOutAfterPush(signOut, links);
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE]);
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
    expect(signOut).toHaveBeenCalledTimes(1);
    const logged = lines.join(' ');
    for (const secret of [DEVICE_ID, KEY, TOKEN]) expect(logged).not.toContain(secret);
  });

  it('with push not mounted (no link), signOut still runs and nothing is sent', async () => {
    const signOut = vi.fn();
    await signOutAfterPush(signOut, createPhoneLinkStore());
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('a registrar run after the leave (a resume, a new token) registers nothing again', async () => {
    const phone = await leavingPhone({ script: { revoke: [answering(200, {})] } });
    await phone.leave();
    await phone.registrar.run();
    await phone.registrar.run({ force: true });
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE]);
    expect(phone.kept()).toBe(false);
  });
});

describe('Forget this server and a new pairing (the connect kit switch): teardown, no second DELETE', () => {
  it("Remove this phone and forget this server: ONE DELETE (the connect kit's), the push item gone", async () => {
    const order: string[] = [];
    const phone = await leavingPhone({ source: 'own', order, record: OWN_RECORD });
    attached(phone);
    const serverSwitch = await serverSwitchOver(order, 'device', PAIRED);
    const transport = fakeTransport((request) => {
      order.push(`${request.method} ${request.url}`);
      return jsonReply(200, {});
    });
    const result = await removeThisPhone({
      store: { load: async () => PAIRED },
      transport,
      forget: serverSwitch.forgetServer,
    });
    expect(result).toEqual({ removed: true });
    const deletes = [...transport.calls, ...phone.world.api.calls].filter(
      (call) => call.method === 'DELETE',
    );
    expect(deletes).toHaveLength(1);
    expect(phone.world.api.calls).toHaveLength(0);
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
    expect(order).toEqual([
      OWN_DELETE,
      ...CLEARED,
      'workspace-id',
      'provider:device',
      'device-clear',
    ]);
  });

  it('Forget this server alone sends nothing from push and still deletes the item', async () => {
    const phone = await leavingPhone({ source: 'own', record: OWN_RECORD });
    attached(phone);
    await (await serverSwitchOver([], 'device', PAIRED)).forgetServer();
    expect(phone.world.api.calls).toHaveLength(0);
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
  });

  it('a new pairing replacing an own server tears push down before the provider, with no DELETE', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({ source: 'own', order, record: OWN_RECORD });
    attached(phone);
    await (await serverSwitchOver(order, 'device', PAIRED)).connectTo(RECORD);
    expect(phone.world.api.calls).toHaveLength(0);
    expect(order).toEqual([...CLEARED, 'workspace-id', 'provider:device', 'save']);
    expect(phone.kept()).toBe(false);
  });

  it('a new pairing leaving the hosted server revokes the hosted row before the workspace id goes', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({
      order,
      script: { revoke: [() => (order.push('DELETE'), jsonReply(200, {}))] },
    });
    attached(phone);
    await (await serverSwitchOver(order, 'clerk', null)).connectTo(RECORD);
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE]);
    expect(order).toEqual(['DELETE', ...CLEARED, 'workspace-id', 'provider:clerk', 'save']);
  });
});

/** Resolves once the listener this provider's onExpired calls has run the push handler. */
function heard(provider: AuthProvider, deps: ExpiryDeps) {
  return new Promise<void>((resolve) => {
    provider.onExpired(() => void onSessionExpired(deps).then(resolve));
  });
}

describe("the provider's onExpired (no connect file edited)", () => {
  it('an own server that revoked this phone (401 device_revoked): the push item and index entry go', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({ source: 'own', order, record: OWN_RECORD });
    let paired: typeof PAIRED | null = PAIRED;
    const { provider, clientAuth } = bindDeviceProvider({
      store: {
        load: async () => paired,
        save: async () => undefined,
        clear: async () => void (paired = null),
      },
    });
    const done = heard(provider, { source: 'own', leave: phone.leave, port: phone.teardown.port });
    await clientAuth.getToken();
    clientAuth.onAuthExpired(new ApiError('auth', { status: 401, code: DEVICE_REVOKED }));
    await done;
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
    expect(order).toEqual(CLEARED);
    expect(phone.world.api.calls).toHaveLength(0);
  });

  it('a Clerk session that expired keeps the record; only the badge and the delivered notifications go', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({ order });
    const provider = createClerkProvider(
      {
        getToken: async () => Promise.reject(Object.assign(new Error('expired'), { status: 401 })),
        signOut: async () => undefined,
      },
      {
        expiry: createExpirySignal(),
        secureKeys: { keys: async () => [], remove: async () => undefined },
      },
    );
    const done = heard(provider, {
      source: 'hosted',
      leave: phone.leave,
      port: phone.teardown.port,
    });
    await expect(provider.getToken()).rejects.toThrow();
    await done;
    expect(order).toEqual(SHOWN);
    expect([phone.kept(), phone.listed()]).toEqual([true, true]);
    expect(phone.world.api.calls).toHaveLength(0);
  });
});
