import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { PUSH_RECORD_ITEM, RECOVERY_MIN_INTERVAL_MS, REREGISTER_AFTER_MS } from '../config';
import { register } from '../registration/register';
import { DEVICE_ID, DEVICE_ROW, WS, sent } from './data-fixtures';
import {
  DENIED,
  GRANTED,
  HOSTED,
  INSTALL_ID,
  KEY,
  NEW_KEY,
  NEW_TOKEN,
  OTHER_DEVICE_ID,
  OTHER_WORKSPACE,
  OWN,
  PHONE,
  T0,
  TOKEN,
  UNDETERMINED,
  answering,
  conflict,
  holding,
  minted,
  offline,
  ok,
  phone,
  setup,
  storedRecord,
} from './registration-fixtures';

// register.ts reaches the key store only through its port; the store under test is the real one
// (registration-fixtures.ts) over a fake SecureStore, so the native module is replaced here.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

afterEach(() => vi.restoreAllMocks());

describe('register: where the server cannot push, nothing is sent', () => {
  it.each([
    ['unsupported', { ...HOSTED, capabilityPush: false }, PHONE],
    ['operator_off', { ...OWN, pushExpo: false }, PHONE],
    ['not_configured', HOSTED, { ...PHONE, projectId: null }],
  ])('%s', async (kind, session, device) => {
    const run = setup({ session, device: phone(device) });
    const outcome = await register(run.deps);
    expect(outcome.status).toEqual({ kind });
    expect(run.api.calls).toHaveLength(0);
    expect(run.device.state.tokenReads).toBe(0);
  });

  it('a phone never asked sends nothing and asks nothing (KP11)', async () => {
    const run = setup({ permission: UNDETERMINED });
    expect((await register(run.deps)).status).toEqual({ kind: 'ask' });
    expect(run.api.calls).toHaveLength(0);
    expect(run.portCalls).toEqual([]);
  });
});

describe('register: the first registration', () => {
  it("posts this phone's facts and keeps the minted key before it counts as on", async () => {
    const run = setup({ script: { register: [minted(KEY)] } });
    const outcome = await register(run.deps);
    expect(sent(run.api.calls[0])).toMatchObject({
      method: 'POST',
      path: '/api/v1/mobile/devices',
      body: {
        install_id: INSTALL_ID,
        platform: 'ios',
        app_version: '1.0.0',
        locale: 'en-IE',
        timezone: 'Europe/Dublin',
        name: 'iPhone 16 Pro',
        expo_push_token: TOKEN,
      },
    });
    expect(outcome.status).toEqual({ kind: 'on' });
    expect(run.keys.held()).toEqual(storedRecord());
  });

  it('a failing save leaves the status not on and keeps no record (own server)', async () => {
    const run = setup({ session: OWN, script: { register: [minted(KEY)] } });
    run.keys.secure.failOn('set', PUSH_RECORD_ITEM);
    const outcome = await register(run.deps);
    expect(outcome.status).toEqual({ kind: 'key_missing' });
    expect(run.keys.held()).toBeNull();
    expect(run.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
  });

  it('a minted key that cannot be kept drops the stale record of the same row', async () => {
    const run = setup({
      session: OWN,
      stored: holding(storedRecord()),
      script: { register: [minted(NEW_KEY)] },
    });
    run.keys.secure.failOn('set', PUSH_RECORD_ITEM);
    run.device.state.token = NEW_TOKEN;
    expect((await register(run.deps)).status).toEqual({ kind: 'key_missing' });
    expect(run.keys.held()).toBeNull();
  });

  it('waits for a time zone, a token or the install id: never a guess', async () => {
    for (const run of [
      setup({ device: phone({ timeZone: null }) }),
      setup({ device: phone({}, null) }),
      setup({ session: { ...HOSTED, getInstallId: async () => null } }),
      setup({ session: { ...HOSTED, getInstallId: () => Promise.reject(new Error('keychain')) } }),
    ]) {
      expect((await register(run.deps)).status).toEqual({ kind: 'off', reason: 'other' });
      expect(run.api.calls).toHaveLength(0);
    }
  });
});

describe('register: the fingerprint rule and the 24 h refresh', () => {
  it('sends nothing when nothing changed within 24 h', async () => {
    const run = setup({ stored: holding(storedRecord()) });
    run.clock.now = T0 + REREGISTER_AFTER_MS - 1;
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(run.api.calls).toHaveLength(0);
  });

  it('sends again after 24 h, or when the clock was set back', async () => {
    for (const now of [T0 + REREGISTER_AFTER_MS, T0 - 1]) {
      const run = setup({ stored: holding(storedRecord()), script: { register: [minted(null)] } });
      run.clock.now = now;
      await register(run.deps);
      expect(run.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
      expect(run.keys.held()).toMatchObject({ pushKey: KEY, registeredAt: now });
    }
  });

  it.each([
    ['the token', { device: phone({}, NEW_TOKEN) }],
    ['the locale', { device: phone({ locale: 'ga-IE' }) }],
    ['the time zone', { device: phone({ timeZone: 'Europe/Lisbon' }) }],
    ['the app version', { device: phone({ appVersion: '1.0.1' }) }],
    ['the name', { device: phone({ name: 'iPhone 17' }) }],
    ['the install id', { session: { ...HOSTED, getInstallId: async () => 'install-new-456' } }],
  ])('sends again when %s changed', async (_what, change) => {
    const run = setup({
      ...change,
      stored: holding(storedRecord()),
      script: { register: [minted(null)] },
    });
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(run.api.calls).toHaveLength(1);
  });

  it('a record of another workspace or server is not this one: it registers afresh', async () => {
    for (const other of [
      { workspaceId: 'another-workspace' },
      { serverOrigin: 'https://other.test' },
    ]) {
      const run = setup({
        stored: holding(storedRecord(other)),
        script: { register: [minted(NEW_KEY)] },
      });
      expect((await register(run.deps)).status).toEqual({ kind: 'on' });
      expect(run.keys.held()).toMatchObject({ workspaceId: WS, pushKey: NEW_KEY });
    }
  });

  it("a person's tap sends though nothing changed", async () => {
    const run = setup({ stored: holding(storedRecord()), script: { register: [minted(null)] } });
    await register(run.deps, undefined, { force: true });
    expect(run.api.calls).toHaveLength(1);
  });
});

describe('register: a null push_key', () => {
  it('keeps the stored key for the same row', async () => {
    const run = setup({
      device: phone({}, NEW_TOKEN),
      stored: holding(storedRecord()),
      script: { register: [minted(null)] },
    });
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(run.keys.held()).toMatchObject({
      deviceId: DEVICE_ID,
      pushKey: KEY,
      expoToken: NEW_TOKEN,
    });
  });

  it('hosted, no key for the row: DELETE its own row, then register once more', async () => {
    const run = setup({ script: { register: [minted(null), minted(NEW_KEY)], revoke: [ok] } });
    const outcome = await register(run.deps);
    expect(run.api.routes()).toEqual([
      'POST /api/v1/mobile/devices',
      `DELETE /api/v1/mobile/devices/${DEVICE_ID}`,
      'POST /api/v1/mobile/devices',
    ]);
    expect(outcome.status).toEqual({ kind: 'on' });
    expect(run.keys.held()).toMatchObject({ deviceId: DEVICE_ID, pushKey: NEW_KEY });
  });

  it('hosted recovery runs at most once a day', async () => {
    const first = setup({ script: { register: [minted(null), minted(null)], revoke: [ok] } });
    expect((await register(first.deps)).status).toEqual({ kind: 'key_missing' });
    expect(first.api.calls).toHaveLength(3);
    const again = setup({ storage: first.storage, script: { register: [minted(null)] } });
    again.clock.now = T0 + RECOVERY_MIN_INTERVAL_MS - 1;
    expect((await register(again.deps)).status).toEqual({ kind: 'key_missing' });
    expect(again.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
  });

  it('a failed DELETE leaves the phone keyless, and the next day it tries again', async () => {
    const run = setup({ script: { register: [minted(null)], revoke: [offline] } });
    const outcome = await register(run.deps);
    expect(outcome.status).toEqual({ kind: 'key_missing' });
    const later = setup({
      storage: run.storage,
      script: { register: [minted(NEW_KEY)], revoke: [ok] },
    });
    later.clock.now = T0 + RECOVERY_MIN_INTERVAL_MS;
    expect((await register(later.deps, outcome.facts)).status).toEqual({ kind: 'on' });
    expect(later.api.routes()[0]).toBe(`DELETE /api/v1/mobile/devices/${DEVICE_ID}`);
  });

  it('own server, no key for the row: key_missing, and never a DELETE', async () => {
    const run = setup({ session: OWN, script: { register: [minted(null)] } });
    const outcome = await register(run.deps);
    expect(outcome.status).toEqual({ kind: 'key_missing' });
    expect(run.api.routes()).toEqual(['POST /api/v1/mobile/devices']);
    expect((await register(run.deps, outcome.facts)).step).toBe('none');
    expect(run.api.calls).toHaveLength(1);
  });

  it("a null key for another row drops that row's record", async () => {
    const stored = holding(storedRecord({ deviceId: OTHER_DEVICE_ID }));
    const device = phone({}, NEW_TOKEN);
    const run = setup({ session: OWN, device, stored, script: { register: [minted(null)] } });
    expect((await register(run.deps)).status).toEqual({ kind: 'key_missing' });
    expect(run.keys.held()).toBeNull();
  });

  it("a recovery in one workspace never holds up another's", async () => {
    const first = setup({ script: { register: [minted(null), minted(KEY)], revoke: [ok] } });
    await register(first.deps);
    const session = { ...HOSTED, workspaceId: OTHER_WORKSPACE };
    const script = {
      register: [minted(null, OTHER_DEVICE_ID), minted(NEW_KEY, OTHER_DEVICE_ID)],
      revoke: [ok],
    };
    const other = setup({ session, storage: first.storage, script });
    expect((await register(other.deps)).status).toEqual({ kind: 'on' });
    expect(other.api.routes()[1]).toBe(`DELETE /api/v1/mobile/devices/${OTHER_DEVICE_ID}`);
  });
});

describe('register: refusals and failures', () => {
  it('a push_key longer than W1 mints is refused at the boundary: nothing is kept', async () => {
    const run = setup({ session: OWN, script: { register: [minted('k'.repeat(129))] } });
    expect((await register(run.deps)).status).toEqual({ kind: 'off', reason: 'other' });
    expect(run.keys.held()).toBeNull();
  });

  it.each([
    ['device_revoked', { kind: 'revoked_by_admin' }],
    ['push_token_in_use', { kind: 'token_elsewhere' }],
    ['install_id_mismatch', { kind: 'off', reason: 'other' }],
    ['install_id_paired', { kind: 'off', reason: 'other' }],
    ['device_limit_reached', { kind: 'device_limit' }],
  ])('409 %s → its status, and no retry', async (code, status) => {
    const run = setup({ script: { register: [conflict(code), minted(KEY)] } });
    const outcome = await register(run.deps);
    expect(outcome.status).toEqual(status);
    expect((await register(run.deps, outcome.facts)).status).toEqual(status);
    expect(run.api.calls).toHaveLength(1);
    expect((await register(run.deps, outcome.facts, { force: true })).status).toEqual({
      kind: 'on',
    });
  });

  it('a network failure keeps the old record and waits', async () => {
    const run = setup({
      device: phone({}, NEW_TOKEN),
      stored: holding(storedRecord()),
      script: { register: [offline] },
    });
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(run.keys.held()).toEqual(storedRecord());
  });

  it('a keychain that refuses the read sends nothing', async () => {
    const run = setup({ script: { register: [minted(KEY)] } });
    run.keys.secure.failOn('get', PUSH_RECORD_ITEM);
    expect((await register(run.deps)).step).toBe('none');
    expect(run.api.calls).toHaveLength(0);
  });

  it('a corrupt record reads as none: it is deleted and the phone registers afresh', async () => {
    const run = setup({
      stored: { [PUSH_RECORD_ITEM]: '{"pushKey": 4' },
      script: { register: [minted(KEY)] },
    });
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(
      run.keys.secure.calls.some((call) => call.op === 'delete' && call.key === PUSH_RECORD_ITEM),
    ).toBe(true);
    expect(run.keys.held()).toEqual(storedRecord());
  });

  it('logs carry kinds and codes, never the token or the key, through every path', async () => {
    const lines: unknown[] = [];
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(logger, level).mockImplementation((...args) => void lines.push(args));
    }
    const runs = [
      setup({ script: { register: [minted(KEY)], revoke: [offline] } }),
      setup({ script: { register: [conflict('push_token_in_use')] } }),
      setup({ script: { register: [offline] } }),
      setup({ permission: DENIED, stored: holding(storedRecord()), script: { update: [offline] } }),
    ];
    runs[0]?.keys.secure.failOn('set', PUSH_RECORD_ITEM);
    for (const run of runs) await register(run.deps);
    expect(lines.length).toBeGreaterThan(0);
    const logged = JSON.stringify(lines);
    const secrets = [TOKEN, KEY, 'ExponentPushToken', INSTALL_ID];
    expect(secrets.filter((secret) => logged.includes(secret))).toEqual([]);
  });
});

describe('register: switched off at the OS (KP10)', () => {
  it('sends PATCH push_enabled false once, then registers again when granted', async () => {
    const run = setup({
      permission: DENIED,
      stored: holding(storedRecord()),
      script: { update: [answering(200, DEVICE_ROW)], register: [minted(null)] },
    });
    expect((await register(run.deps)).status).toEqual({ kind: 'denied' });
    expect(sent(run.api.calls[0])).toMatchObject({
      method: 'PATCH',
      path: `/api/v1/mobile/devices/${DEVICE_ID}`,
      body: { push_enabled: false },
    });
    expect(run.keys.held()).toMatchObject({ switchedOff: true });
    await register(run.deps);
    expect(run.api.calls).toHaveLength(1);
    run.permission.answer = GRANTED;
    expect((await register(run.deps)).status).toEqual({ kind: 'on' });
    expect(run.api.routes()[1]).toBe('POST /api/v1/mobile/devices');
    expect(run.keys.held()).toMatchObject({ switchedOff: false, pushKey: KEY });
  });

  it('a failed PATCH is sent again on the next resume; a gone row counts as told', async () => {
    const run = setup({
      permission: DENIED,
      stored: holding(storedRecord()),
      script: { update: [offline, answering(404, { detail: 'Device not found.' })] },
    });
    await register(run.deps);
    expect(run.keys.held()).toMatchObject({ switchedOff: false });
    await register(run.deps);
    expect(run.keys.held()).toMatchObject({ switchedOff: true });
    expect(run.api.calls).toHaveLength(2);
  });
});
