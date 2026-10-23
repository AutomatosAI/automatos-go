// Remove this phone and forget this server (US-006i): DELETE this phone's own device row with its
// own token, then forget; a refusal, no network or an unreadable keychain still forgets on the
// phone, and the result names the server so the shell can say Studio may still list the phone.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { AUTHORIZATION_HEADER, WORKSPACE_HEADER } from '../../api/auth-headers';
import {
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
} from '../../api/__tests__/fake-transport';
import type { StreamingResponse, TransportRequest } from '../../api/transport-types';
import { PAIRED_RECORD_ITEM } from '../config';
import type { PairedRecord } from '../device-store';
import { FORGET_SERVER_COPY, REMOVE_DEVICE_COPY } from '../strings';
import { RECORD, TOKEN } from './paired-record';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const { createDeviceStore } = await import('../device-store');
const { keychainWith } = await import('./paired-record');
const { removeThisPhone } = await import('../remove-device');

const DELETE_URL = `${RECORD.origin}/api/v1/mobile/devices/${RECORD.deviceId}`;
const HOME = 'Home NAS (192.168.1.20:8000)';
/** DELETE answers the device's to_dict(), which is never read. */
const REVOKED_ROW = { id: RECORD.deviceId, status: 'revoked', revoked_by: 7, events: [] };

function pairedStore(record: PairedRecord | null = RECORD) {
  const { store: keychain, registry } = keychainWith(
    record ? { [PAIRED_RECORD_ITEM]: JSON.stringify(record) } : {},
  );
  return { keychain, store: createDeviceStore({ keys: registry, deviceOnly: true }) };
}

type Responder = (request: TransportRequest) => StreamingResponse | Promise<StreamingResponse>;

/** forget() as switch.forgetServer: it clears the store; `events` shows the order. */
function setUp(respond: Responder) {
  const events: string[] = [];
  const { keychain, store } = pairedStore();
  const transport = fakeTransport((request) => {
    events.push(`${request.method} ${request.url}`);
    return respond(request);
  });
  const forget = vi.fn(async () => {
    events.push('forget');
    await store.clear();
  });
  return { events, keychain, store, transport, forget };
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

function logged(): string {
  return spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => String(arg))
    .join('\n');
}

describe('Remove this phone: DELETE, then forget', () => {
  it("DELETEs this phone's own row with its own token, then forgets it", async () => {
    const run = setUp(() => jsonReply(200, REVOKED_ROW));
    const result = await removeThisPhone(run);
    expect(result).toEqual({ removed: true });
    expect(run.events).toEqual([`DELETE ${DELETE_URL}`, 'forget']);
    const [call] = run.transport.calls as [TransportRequest];
    expect(call.headers[AUTHORIZATION_HEADER]).toBe(`Bearer ${TOKEN}`);
    expect(call.headers[WORKSPACE_HEADER]).toBeUndefined();
    expect(call.body).toBeUndefined();
    expect(await run.store.load()).toBeNull();
  });

  it('a phone the server already revoked (401 device_revoked) counts as removed', async () => {
    const run = setUp(() => jsonReply(401, { detail: { code: 'device_revoked' } }));
    expect(await removeThisPhone(run)).toEqual({ removed: true });
    expect(run.forget).toHaveBeenCalledOnce();
  });
});

describe('best effort: the phone forgets the server anyway', () => {
  const refusals: readonly (readonly [string, Responder])[] = [
    [
      'offline',
      () => {
        throw new TypeError('Network request failed');
      },
    ],
    ['a plain 401', () => jsonReply(401, { detail: 'Invalid or expired token' })],
    ['a paused workspace (403)', () => jsonReply(403, { detail: 'Workspace is disabled.' })],
    ['not found (404)', () => jsonReply(404, { detail: 'Device not found.' })],
    ['a server failure (503)', () => reply(503)],
  ];

  it.each(refusals)('%s: forgotten here, and the result names the server', async (_, respond) => {
    const run = setUp(respond);
    const result = await removeThisPhone(run);
    expect(result).toEqual({ removed: false, server: HOME });
    expect(run.events.at(-1)).toBe('forget');
    expect(await run.store.load()).toBeNull();
    expect(logged()).not.toContain('amd_');
  });

  it('a server that never answers is forgotten after the timeout, not the client default', async () => {
    const run = setUp(hangUntilAborted);
    const result = await removeThisPhone({ ...run, timeoutMs: 5 });
    expect(result).toEqual({ removed: false, server: HOME });
    expect(run.forget).toHaveBeenCalledOnce();
  });

  it('a keychain that will not read: no call, still forgotten', async () => {
    const run = setUp(() => jsonReply(200, REVOKED_ROW));
    run.keychain.failOn('get', PAIRED_RECORD_ITEM);
    const result = await removeThisPhone(run);
    expect(result).toEqual({ removed: false, server: null });
    expect(run.transport.calls).toHaveLength(0);
    expect(run.forget).toHaveBeenCalledOnce();
  });

  it('nothing paired: no call, just the forget', async () => {
    const { store } = pairedStore(null);
    const transport = fakeTransport(() => jsonReply(200, REVOKED_ROW));
    const forget = vi.fn(async () => undefined);
    expect(await removeThisPhone({ store, transport, forget })).toEqual({
      removed: false,
      server: null,
    });
    expect(transport.calls).toHaveLength(0);
    expect(forget).toHaveBeenCalledOnce();
  });

  it('a forget that fails rejects, as switch.forgetServer does (the shell keeps the person there)', async () => {
    const run = setUp(() => jsonReply(200, REVOKED_ROW));
    const forget = vi.fn(async () => {
      throw new Error('disk');
    });
    await expect(removeThisPhone({ ...run, forget })).rejects.toThrow('disk');
  });
});

describe('the copy (D63, US-006i)', () => {
  it("the Account action reads 'Remove this phone and forget this server'", () => {
    expect(FORGET_SERVER_COPY.action).toBe('Remove this phone and forget this server');
  });

  it('says Studio may still list the phone, in the question and when the server was not told', () => {
    expect(FORGET_SERVER_COPY.question(HOME)).toContain('Studio may still list this phone');
    expect(REMOVE_DEVICE_COPY.notRemoved(HOME)).toBe(
      "This phone forgot Home NAS (192.168.1.20:8000), but couldn't remove itself there. Studio may still list it: remove it in Studio → Settings → Phones & devices.",
    );
  });

  it('names no account, workspace or deletion', () => {
    const words = [REMOVE_DEVICE_COPY.notRemoved(HOME), FORGET_SERVER_COPY.question(HOME)].join(
      ' ',
    );
    expect(words).not.toMatch(/delete|account|workspace/i);
  });
});
