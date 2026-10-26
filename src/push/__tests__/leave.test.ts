// The session's leave in detail (US-014i, bind/leave.ts): the DELETE waits SIGN_OUT_DELETE_TIMEOUT_MS
// and no longer; a row whose DELETE failed is revoked on the next try although the record is gone;
// a row already gone counts; an own server never DELETEs; a push record of another server is
// cleared when a session starts; clearShown runs past a failing step. Then the seams, read as
// source: the connect kit's switch.ts and ServerSection.tsx each gained one awaited call before the
// provider is cleared, remove-device.ts keeps its own DELETE, PushRoot attaches the leave, clears a
// leftover before the first run and listens to onExpired, and the seam modules stay pure.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearLeftover, pushLeaveFor } from '../bind/leave';
import { SIGN_OUT_DELETE_TIMEOUT_MS } from '../config';
import { clearShown } from '../teardown';
import { DEVICE_ID } from './data-fixtures';
import { spyOnLogger } from './handler-fixtures';
import { leavingPhone, teardownOver } from './leave-fixtures';
import {
  answering,
  ok,
  offline,
  OTHER_WORKSPACE,
  storedRecord,
  type Answer,
} from './registration-fixtures';
import { importsOf, sources } from './source-files';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const DELETE_ROUTE = `DELETE /api/v1/mobile/devices/${DEVICE_ID}`;
const CLEARED = ['badge:0', 'dismiss', 'handled', 'prompt'];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the hosted DELETE: best effort, SIGN_OUT_DELETE_TIMEOUT_MS', () => {
  it('is 4000 ms', () => {
    expect(SIGN_OUT_DELETE_TIMEOUT_MS).toBe(4000);
  });

  it('a server that never answers: the phone is cleared at 4000 ms, not before', async () => {
    vi.useFakeTimers();
    const silent: Answer = () => new Promise(() => undefined);
    const phone = await leavingPhone({ script: { revoke: [silent] } });
    let outcome: unknown = null;
    void phone.leave().then((done) => (outcome = done));
    await vi.advanceTimersByTimeAsync(SIGN_OUT_DELETE_TIMEOUT_MS - 1);
    expect(outcome).toBeNull();
    expect(phone.kept()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toEqual({ revoked: false, failed: [] });
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
    expect(phone.world.api.calls[0]?.signal?.aborted).toBe(true);
  });

  it('a run under way that never ends: leaving goes on after 4000 ms, the DELETE still sent', async () => {
    vi.useFakeTimers();
    const phone = await leavingPhone({ script: { revoke: [ok] } });
    const stuck = { close: () => new Promise<void>(() => undefined) };
    const leave = pushLeaveFor({ ...phone.deps, registrar: stuck });
    let outcome: unknown = null;
    void leave().then((done) => (outcome = done));
    await vi.advanceTimersByTimeAsync(SIGN_OUT_DELETE_TIMEOUT_MS - 1);
    expect(phone.world.api.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toEqual({ revoked: true, failed: [] });
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE]);
    expect(phone.kept()).toBe(false);
  });

  it('a sign-out that failed after an offline DELETE revokes the same row on the next try', async () => {
    const phone = await leavingPhone({ script: { revoke: [offline, ok] } });
    expect(await phone.leave()).toEqual({ revoked: false, failed: [] });
    expect(phone.kept()).toBe(false);
    expect(await phone.leave()).toEqual({ revoked: true, failed: [] });
    expect(phone.world.api.routes()).toEqual([DELETE_ROUTE, DELETE_ROUTE]);
    // revoked: nothing is remembered, so a third leave sends nothing
    await phone.leave();
    expect(phone.world.api.calls).toHaveLength(2);
  });

  it('a row already gone (404) counts as revoked', async () => {
    const phone = await leavingPhone({ script: { revoke: [answering(404, { detail: 'x' })] } });
    expect(await phone.leave()).toEqual({ revoked: true, failed: [] });
  });

  it("no record for this session (another workspace's): no DELETE, still cleared", async () => {
    const order: string[] = [];
    const phone = await leavingPhone({
      order,
      record: storedRecord({ workspaceId: OTHER_WORKSPACE }),
    });
    expect(await phone.leave()).toEqual({ revoked: false, failed: [] });
    expect(phone.world.api.calls).toHaveLength(0);
    expect(order).toEqual(CLEARED);
    expect(phone.kept()).toBe(false);
  });

  it("an own server never DELETEs: its row is the connect kit's", async () => {
    const phone = await leavingPhone({ source: 'own', script: { revoke: [ok] } });
    expect(await phone.leave()).toEqual({ revoked: false, failed: [] });
    expect(phone.world.api.calls).toHaveLength(0);
    expect(phone.kept()).toBe(false);
  });
});

describe('clearLeftover: a record of another server, when a session starts', () => {
  it('another server: cleared; this server, none: kept', async () => {
    const order: string[] = [];
    const phone = await leavingPhone({ order });
    const deps = { store: phone.world.keys.store, teardown: phone.teardown };
    expect(await clearLeftover({ ...deps, serverOrigin: phone.deps.scope.serverOrigin })).toBe(
      false,
    );
    expect(phone.kept()).toBe(true);
    expect(await clearLeftover({ ...deps, serverOrigin: 'http://192.168.1.20:8000' })).toBe(true);
    expect([phone.kept(), phone.listed()]).toEqual([false, false]);
    expect(order).toEqual(CLEARED);
    expect(await clearLeftover({ ...deps, serverOrigin: 'http://192.168.1.20:8000' })).toBe(false);
  });

  it('a keychain that refuses the read: nothing cleared, nothing thrown, the cause not logged', async () => {
    const lines = spyOnLogger();
    const order: string[] = [];
    const store = { load: async () => Promise.reject(new Error('keychain locked')) };
    const teardown = teardownOver({ clear: async () => void order.push('clear') }, order);
    expect(await clearLeftover({ serverOrigin: 'x', store, teardown })).toBe(false);
    expect(order).toEqual([]);
    expect(lines.join(' ')).not.toContain('keychain locked');
  });
});

describe('clearShown (a Clerk session that expired)', () => {
  it('sets the badge to 0 and dismisses, past a failing step, and never touches the record', async () => {
    const order: string[] = [];
    const port = {
      setBadgeCountAsync: async () => Promise.reject(new Error('no badge')),
      dismissAllNotificationsAsync: async () => void order.push('dismiss'),
    };
    expect(await clearShown({ port })).toEqual({ failed: ['badge'] });
    expect(order).toEqual(['dismiss']);
  });
});

describe('the seams (read as source)', () => {
  const root = path.resolve(__dirname, '../../..');
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

  it('switch.ts clears push first in clearSession: before the cache, the workspace id and the provider', () => {
    const text = read('src/connect/switch.ts');
    const body = text.slice(text.indexOf('async function clearSession'));
    const push = body.indexOf('await clearPushBeforeLeaving();');
    expect(text.match(/clearPushBeforeLeaving\(\)/g)).toHaveLength(1);
    expect(push).toBeGreaterThan(-1);
    expect(push).toBeLessThan(body.indexOf('await clearQueryCache('));
    expect(push).toBeLessThan(body.indexOf('deps.workspaceIds.clear()'));
    expect(push).toBeLessThan(body.indexOf('await deps.provider.signOut()'));
  });

  it("ServerSection's Sign out runs push first; remove-device.ts keeps its own DELETE", () => {
    const section = read('src/connect/components/ServerSection.tsx');
    expect(section.match(/usePushSignOut\(useSignOut\(\)\)/g)).toHaveLength(1);
    expect(section).toContain('const { signOut, busy } = pushSignOut;');
    expect(section).toContain('SHELL_COPY.signOut');
    const remove = read('src/connect/remove-device.ts');
    expect(remove).toContain('CONNECT_ROUTES.removeDevice');
    expect(importsOf(remove, /push/)).toEqual([]);
  });

  it('PushRoot attaches the leave, clears a leftover before the first run, listens to onExpired', () => {
    const text = read('src/push/PushRoot.tsx');
    expect(text).toContain('phoneLinks.attach({ registrar, askPermission, removal, leave })');
    expect(text.indexOf('.then(clearLeftover)')).toBeLessThan(
      text.indexOf('.then(() => registrar.run())'),
    );
    expect(text).toContain('provider.onExpired(() => void expired())');
    expect(text).toContain('useExpiry(session.provider, wiring);');
  });

  it('the seam and the leave import no React, React Native or Expo module', () => {
    const files = sources(path.join(root, 'src/push/bind')).filter(({ file }) =>
      /(before-leaving|leave)\.ts$/.test(file),
    );
    expect(files).toHaveLength(2);
    const native = files.flatMap(({ text }) =>
      importsOf(text, /^(react|react-native|expo)(-|\/|$)/),
    );
    expect(native).toEqual([]);
  });
});
