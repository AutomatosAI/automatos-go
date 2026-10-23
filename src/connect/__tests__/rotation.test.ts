// Token rotation (US-006i): due and not due, one call for concurrent callers, the new token in the
// keychain before anything uses it, the old token kept on any failure, and never two rotations for
// one rotateAfter. Over a fake keychain (the app's registry) and a fake transport.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AUTHORIZATION_HEADER, WORKSPACE_HEADER } from '../../api/auth-headers';
import {
  fakeTransport,
  flush,
  jsonReply,
  reply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import type { StreamingResponse, TransportRequest } from '../../api/transport-types';
import { createDeviceProvider, createRefusalSource } from '../../auth/providers/device';
import { createExpirySignal } from '../../auth/providers/expiry';
import { fakeSecureStore, KEYCHAIN_OPTIONS } from '../../lib/__tests__/fake-secure-store';
import { createSecureKeyRegistry, type AsyncSecureStore } from '../../lib/secure-keys';
import { STORAGE_KEY_ITEM } from '../../storage/encrypted-storage';
import { PAIRED_RECORD_ITEM } from '../config';
import type { PairedRecord } from '../device-store';
import { CLERK_CLIENT_ITEM, OTHER_RECORD, RECORD, TOKEN } from './paired-record';

// device-store.ts wires the app's keychain; these tests pass a store over a fake one instead.
vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const { createDeviceStore } = await import('../device-store');
const { createTokenRotation, instantOf, rotatesOn, rotationDue } = await import('../rotation');
const { rotateResponseSchema } = await import('../schemas');

const NEW_TOKEN = `amd_${'N'.repeat(43)}`;
const NEW_ROTATE_AFTER = '2026-12-20T10:00:00.654321+00:00';
const DUE = Object.freeze({ ...RECORD, rotateAfter: '2026-10-22T10:00:00.123456+00:00' });
const NOW = new Date('2026-10-23T09:00:00.000Z');
const ROTATE_URL = `${RECORD.origin}/api/v1/mobile/devices/${RECORD.deviceId}/rotate`;
const ROTATED = Object.freeze({
  device_id: RECORD.deviceId,
  token: NEW_TOKEN,
  rotate_after: NEW_ROTATE_AFTER,
  previous_token_valid_until: '2026-10-23T09:10:00.000000+00:00',
  overlap_seconds: 600,
});

/** A keychain whose writes can be held open: `hold()` holds the next ones until `release()`. */
function keychainHolding(record: PairedRecord | null) {
  const inner = fakeSecureStore(record ? { [PAIRED_RECORD_ITEM]: JSON.stringify(record) } : {});
  const events: string[] = [];
  let gate: Promise<void> = Promise.resolve();
  let release = () => undefined as void;
  const store: AsyncSecureStore = {
    getItemAsync: inner.getItemAsync,
    deleteItemAsync: inner.deleteItemAsync,
    setItemAsync: async (key, value, options) => {
      await gate;
      await inner.setItemAsync(key, value, options);
      if (key === PAIRED_RECORD_ITEM) events.push(`write ${JSON.parse(value).token}`);
    },
  };
  const registry = createSecureKeyRegistry({
    store,
    options: KEYCHAIN_OPTIONS,
    fixedKeys: [STORAGE_KEY_ITEM, CLERK_CLIENT_ITEM],
  });
  return {
    inner,
    events,
    devices: createDeviceStore({ keys: registry, deviceOnly: true }),
    hold: () => {
      gate = new Promise<void>((open) => {
        release = open;
      });
    },
    release: () => release(),
  };
}

/** A transport whose answer waits until `answer()` is called. */
function heldTransport(response: StreamingResponse) {
  let answer = () => undefined as void;
  const answered = new Promise<void>((open) => {
    answer = open;
  });
  const transport = fakeTransport(async () => {
    await answered;
    return response;
  });
  return { transport, answer: () => answer() };
}

function rotationOver(
  devices: ReturnType<typeof keychainHolding>['devices'],
  transport: FakeTransport,
) {
  return createTokenRotation({ store: devices, transport, now: () => NOW });
}

const consoleMethods = ['log', 'info', 'warn', 'error'] as const;

let spies: MockInstance[] = [];

beforeEach(() => {
  spies = consoleMethods.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every console argument this test logged, as text. */
function logged(): string {
  return spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (arg instanceof Error ? `${arg.message} ${String(arg.cause)}` : String(arg)))
    .join('\n');
}

describe('rotationDue (pure)', () => {
  it('is due from rotateAfter on, and not a millisecond before', () => {
    const at = new Date('2026-11-20T10:00:00.123Z');
    expect(rotationDue(RECORD, at)).toBe(true);
    expect(rotationDue(RECORD, new Date(at.getTime() + 1))).toBe(true);
    expect(rotationDue(RECORD, new Date(at.getTime() - 1))).toBe(false);
    expect(rotationDue(RECORD, NOW)).toBe(false);
    expect(rotationDue(DUE, NOW)).toBe(true);
  });

  it("reads Python's microseconds and an offset, and never calls a date it can't read due", () => {
    expect(instantOf('2026-11-20T10:00:00.123456+00:00')).toBe(
      Date.UTC(2026, 10, 20, 10, 0, 0, 123),
    );
    expect(instantOf('2026-11-20T11:00:00+01:00')).toBe(Date.UTC(2026, 10, 20, 10));
    expect(rotationDue({ rotateAfter: 'not a date' }, NOW)).toBe(false);
  });

  it('runs on launch and resume only, never on a refusal', () => {
    expect(rotatesOn('launch')).toBe(true);
    expect(rotatesOn('resume')).toBe(true);
    expect(rotatesOn('forbidden')).toBe(false);
  });
});

describe('the rotate answer (W1 api/mobile_devices.py rotate_device_token)', () => {
  it('reads the four fields and drops unknown ones', () => {
    const parsed = rotateResponseSchema.parse(ROTATED);
    expect(Object.keys(parsed).sort()).toEqual([
      'device_id',
      'previous_token_valid_until',
      'rotate_after',
      'token',
    ]);
  });

  it('refuses a token that is not a device token', () => {
    expect(rotateResponseSchema.safeParse({ ...ROTATED, token: 'sk_live_x' }).success).toBe(false);
  });
});

describe('rotateIfDue', () => {
  it('does nothing with no pairing, or before rotateAfter', async () => {
    const transport = fakeTransport(() => jsonReply(200, ROTATED));
    expect(await rotationOver(keychainHolding(null).devices, transport).rotateIfDue()).toBe('none');
    const early = rotationOver(keychainHolding(RECORD).devices, transport);
    expect(await early.rotateIfDue()).toBe('not_due');
    expect(transport.calls).toHaveLength(0);
  });

  it('POSTs rotate to the paired origin with the CURRENT token and no workspace header', async () => {
    const keychain = keychainHolding(DUE);
    const transport = fakeTransport(() => jsonReply(200, ROTATED));
    expect(await rotationOver(keychain.devices, transport).rotateIfDue()).toBe('rotated');
    const [call] = transport.calls as [TransportRequest];
    expect(call.method).toBe('POST');
    expect(call.url).toBe(ROTATE_URL);
    expect(call.headers[AUTHORIZATION_HEADER]).toBe(`Bearer ${TOKEN}`);
    expect(call.headers[WORKSPACE_HEADER]).toBeUndefined();
  });

  it('keeps the pairing: only the token and rotateAfter change', async () => {
    const keychain = keychainHolding(DUE);
    await rotationOver(
      keychain.devices,
      fakeTransport(() => jsonReply(200, ROTATED)),
    ).rotateIfDue();
    const kept = { ...DUE, token: NEW_TOKEN, rotateAfter: NEW_ROTATE_AFTER };
    expect(await keychain.devices.load()).toEqual(kept);
    expect(JSON.parse(keychain.inner.items.get(PAIRED_RECORD_ITEM) ?? '{}')).toEqual(kept);
  });

  it('is single-flight: 3 concurrent callers share one call and one result', async () => {
    const keychain = keychainHolding(DUE);
    const { transport, answer } = heldTransport(jsonReply(200, ROTATED));
    const rotation = rotationOver(keychain.devices, transport);
    const callers = [rotation.rotateIfDue(), rotation.rotateIfDue(), rotation.rotateIfDue()];
    await flush();
    expect(transport.calls).toHaveLength(1);
    answer();
    expect(await Promise.all(callers)).toEqual(['rotated', 'rotated', 'rotated']);
    expect(transport.calls).toHaveLength(1);
  });

  it('never rotates twice for one rotateAfter: the next launch or resume finds it not due', async () => {
    const keychain = keychainHolding(DUE);
    const transport = fakeTransport(() => jsonReply(200, ROTATED));
    const rotation = rotationOver(keychain.devices, transport);
    expect(await rotation.rotateIfDue()).toBe('rotated');
    expect(await rotation.rotateIfDue()).toBe('not_due');
    expect(transport.calls).toHaveLength(1);
  });
});

describe('write before use', () => {
  it('the provider hands out the new token only once the keychain holds it', async () => {
    const keychain = keychainHolding(DUE);
    const provider = createDeviceProvider({
      store: keychain.devices,
      expiry: createExpirySignal(),
      refusals: createRefusalSource(),
    });
    expect(await provider.getToken()).toBe(TOKEN);
    keychain.hold();
    const rotating = rotationOver(
      keychain.devices,
      fakeTransport(() => jsonReply(200, ROTATED)),
    ).rotateIfDue();
    await flush();
    const token = provider.getToken().then((value) => {
      keychain.events.push(`use ${value}`);
      return value;
    });
    await flush();
    expect(keychain.events).toEqual([]);
    expect(JSON.parse(keychain.inner.items.get(PAIRED_RECORD_ITEM) ?? '{}').token).toBe(TOKEN);
    keychain.release();
    expect(await rotating).toBe('rotated');
    expect(await token).toBe(NEW_TOKEN);
    expect(keychain.events).toEqual([`write ${NEW_TOKEN}`, `use ${NEW_TOKEN}`]);
  });

  it('a failed write keeps the old token, and the same rotateAfter is never rotated again', async () => {
    const keychain = keychainHolding(DUE);
    keychain.inner.failOn('set', PAIRED_RECORD_ITEM);
    const transport = fakeTransport(() => jsonReply(200, ROTATED));
    const rotation = rotationOver(keychain.devices, transport);
    expect(await rotation.rotateIfDue()).toBe('not_saved');
    expect(await keychain.devices.load()).toEqual(DUE);
    expect(JSON.parse(keychain.inner.items.get(PAIRED_RECORD_ITEM) ?? '{}')).toEqual(DUE);
    expect(await rotation.rotateIfDue()).toBe('spent');
    expect(transport.calls).toHaveLength(1);
    expect(logged()).not.toContain('amd_');
  });

  it('never brings back a pairing forgotten, or replaced, while the call ran', async () => {
    for (const change of ['forgotten', 'paired again'] as const) {
      const keychain = keychainHolding(DUE);
      const { transport, answer } = heldTransport(jsonReply(200, ROTATED));
      const rotating = rotationOver(keychain.devices, transport).rotateIfDue();
      await flush();
      if (change === 'forgotten') await keychain.devices.clear();
      else await keychain.devices.save(OTHER_RECORD);
      answer();
      expect(await rotating).toBe('not_saved');
      expect(await keychain.devices.load()).toEqual(change === 'forgotten' ? null : OTHER_RECORD);
    }
  });

  it('a forget while the new token is still being written leaves no record in the keychain', async () => {
    const keychain = keychainHolding(DUE);
    await keychain.devices.load();
    keychain.hold();
    const rotating = rotationOver(
      keychain.devices,
      fakeTransport(() => jsonReply(200, ROTATED)),
    ).rotateIfDue();
    await flush();
    // the registry runs keychain writes and removes in call order: the remove follows the write
    const forgetting = keychain.devices.clear();
    keychain.release();
    await Promise.all([rotating, forgetting]);
    expect(keychain.events).toEqual([`write ${NEW_TOKEN}`]);
    expect(keychain.inner.items.has(PAIRED_RECORD_ITEM)).toBe(false);
    expect(await keychain.devices.load()).toBeNull();
  });
});

describe('a failed rotate keeps the old token', () => {
  const failures: readonly (readonly [string, () => StreamingResponse])[] = [
    [
      'no network',
      () => {
        throw new TypeError('Network request failed');
      },
    ],
    ['a server failure', () => reply(503, '{"detail": "Pairing is unavailable right now."}')],
    ['a revoked device (401)', () => jsonReply(401, { detail: { code: 'device_revoked' } })],
    ['a paused workspace (403)', () => jsonReply(403, { detail: 'Workspace is disabled.' })],
    ['an answer it cannot read', () => jsonReply(200, { ...ROTATED, token: undefined })],
    [
      'another device in the answer',
      () => jsonReply(200, { ...ROTATED, device_id: OTHER_RECORD.deviceId }),
    ],
  ];

  it.each(failures)(
    '%s: the old token stays; the next launch or resume tries again',
    async (_, respond) => {
      const keychain = keychainHolding(DUE);
      let attempt = 0;
      const transport = fakeTransport(() =>
        attempt++ === 0 ? respond() : jsonReply(200, ROTATED),
      );
      const rotation = rotationOver(keychain.devices, transport);
      expect(await rotation.rotateIfDue()).toBe('failed');
      expect(await keychain.devices.load()).toEqual(DUE);
      expect(await rotation.rotateIfDue()).toBe('rotated');
      expect(transport.calls).toHaveLength(2);
      expect(logged()).not.toContain('amd_');
    },
  );

  it('a token already rotated out (409 token_superseded) is never sent to rotate again', async () => {
    const keychain = keychainHolding(DUE);
    const transport = fakeTransport(() => jsonReply(409, { detail: { code: 'token_superseded' } }));
    const rotation = rotationOver(keychain.devices, transport);
    expect(await rotation.rotateIfDue()).toBe('superseded');
    expect(await rotation.rotateIfDue()).toBe('spent');
    expect(transport.calls).toHaveLength(1);
    expect(await keychain.devices.load()).toEqual(DUE);
  });

  it('a 401 on rotate ends nothing by itself: the old record stays for the next call to hear', async () => {
    const keychain = keychainHolding(DUE);
    const transport = fakeTransport(() => jsonReply(401, { detail: { code: 'device_revoked' } }));
    await rotationOver(keychain.devices, transport).rotateIfDue();
    expect(await keychain.devices.load()).toEqual(DUE);
  });

  it('a keychain that will not read: failed, never rejected, and no call', async () => {
    const keychain = keychainHolding(DUE);
    keychain.inner.failOn('get', PAIRED_RECORD_ITEM);
    const transport = fakeTransport(() => jsonReply(200, ROTATED));
    await expect(rotationOver(keychain.devices, transport).rotateIfDue()).resolves.toBe('failed');
    expect(transport.calls).toHaveLength(0);
  });

  it('logs neither the old token nor the new one', async () => {
    const keychain = keychainHolding(DUE);
    await rotationOver(
      keychain.devices,
      fakeTransport(() => jsonReply(200, ROTATED)),
    ).rotateIfDue();
    await rotationOver(
      keychainHolding(DUE).devices,
      fakeTransport(() => jsonReply(409, { detail: { code: 'token_superseded' } })),
    ).rotateIfDue();
    expect(logged()).not.toMatch(/amd_/);
  });
});
