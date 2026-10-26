import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClientOptions } from '../../api/client';
import { ApiError } from '../../api/errors';
import {
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import type { StreamingResponse } from '../../api/transport-types';
import type { PairInput } from '../api';

// The one client, wrapped: each test can read the options pairDevice built its client with.
const built = vi.hoisted(() => ({ options: [] as ApiClientOptions[] }));
vi.mock('../../api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../api/client')>();
  return {
    ...real,
    createApiClient: (options: ApiClientOptions) => {
      built.options.push(options);
      return real.createApiClient(options);
    },
  };
});

const { createApiClient } = await import('../../api/client');
const { pairDevice, pairRefusalFor } = await import('../api');
const { CONNECT_ROUTES } = await import('../routes');
const { pairResponseSchema } = await import('../schemas');

const ORIGIN = 'https://automatos.example.test';
const LAN_ORIGIN = 'http://192.168.1.20:8000';
const TOKEN = 'amd_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5';
const ANSWER = {
  device_id: '4a0f6c5e-8f43-4d5e-9b7a-1f2e3d4c5b6a',
  workspace_id: '9b1d2c3e-4f50-4617-8a9b-0c1d2e3f4a5b',
  token: TOKEN,
  rotate_after: '2027-01-19T10:00:00.123456+00:00',
};
const INPUT: PairInput = {
  origin: ORIGIN,
  code: 'abcd efgh',
  installId: 'AAECAwQFBgcICQoLDA0ODw',
  name: 'Automatos Go on iPhone',
  platform: 'ios',
  appVersion: '1.0.0',
};

function answering(response: StreamingResponse | (() => never)): FakeTransport {
  return fakeTransport(() => (typeof response === 'function' ? response() : response));
}

async function pairWith(response: StreamingResponse, input: Partial<PairInput> = {}) {
  const transport = answering(response);
  const result = await pairDevice({ ...INPUT, ...input }, { transport });
  return { result, transport };
}

const consoleMethods = ['log', 'info', 'warn', 'error'] as const;

describe('CONNECT_ROUTES (KC3)', () => {
  it('names pair, rotate and Remove this phone, all served at the pin (PRD-266 W1)', () => {
    expect(CONNECT_ROUTES).toEqual({
      pair: { method: 'POST', path: '/api/v1/mobile/pair' },
      rotate: { method: 'POST', path: '/api/v1/mobile/devices/{device_id}/rotate' },
      removeDevice: { method: 'DELETE', path: '/api/v1/mobile/devices/{device_id}' },
    });
  });

  it('repeats neither discovery nor the workspace bootstrap', () => {
    const paths = Object.values(CONNECT_ROUTES).map((route) => route.path);
    expect(paths).not.toContain('/.well-known/automatos.json');
    expect(paths).not.toContain('/api/workspaces/current');
  });
});

describe('pairDevice: the request', () => {
  beforeEach(() => {
    built.options.length = 0;
  });

  it('POSTs the canonical code, the name, platform, version and install id as JSON', async () => {
    const { transport } = await pairWith(jsonReply(200, ANSWER));
    expect(transport.calls).toHaveLength(1);
    const [call] = transport.calls;
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe(`${ORIGIN}/api/v1/mobile/pair`);
    expect(JSON.parse(String(call?.body))).toEqual({
      code: 'ABCD-EFGH',
      name: 'Automatos Go on iPhone',
      platform: 'ios',
      app_version: '1.0.0',
      install_id: 'AAECAwQFBgcICQoLDA0ODw',
    });
    expect(call?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends no Authorization and no X-Workspace-ID header', async () => {
    const { transport } = await pairWith(jsonReply(200, ANSWER));
    const headers = Object.keys(transport.calls[0]?.headers ?? {}).map((name) =>
      name.toLowerCase(),
    );
    expect(headers).not.toContain('authorization');
    expect(headers).not.toContain('x-workspace-id');
  });

  it('always sends XXXX-XXXX, however the code was typed (KC7)', async () => {
    for (const code of ['ABCDEFGH', 'abcd-efgh', ' AbCd EfGh ', 'ABCD-EFGH']) {
      const { transport } = await pairWith(jsonReply(200, ANSWER), { code });
      expect(JSON.parse(String(transport.calls[0]?.body)).code).toBe('ABCD-EFGH');
    }
  });

  it('leaves out an unknown app version rather than sending a blank one', async () => {
    const { transport } = await pairWith(jsonReply(200, ANSWER), { appVersion: undefined });
    expect(JSON.parse(String(transport.calls[0]?.body))).not.toHaveProperty('app_version');
  });

  it('pairs a home server over http on a private address', async () => {
    const { result, transport } = await pairWith(jsonReply(200, ANSWER), { origin: LAN_ORIGIN });
    expect(result.ok).toBe(true);
    expect(transport.calls[0]?.url).toBe(`${LAN_ORIGIN}/api/v1/mobile/pair`);
  });

  it('builds its client with no credential and its own no-op expiry callback', async () => {
    await pairWith(reply(401, JSON.stringify({ detail: { code: 'invalid_pairing_code' } })));
    const [options] = built.options;
    expect(await options?.getToken()).toBeNull();
    expect(options?.getWorkspaceId()).toBeNull();
    expect(options?.onAuthExpired).toBeTypeOf('function');
    expect(options?.onAuthExpired?.()).toBeUndefined();
    expect(options?.server).toEqual({ apiUrl: ORIGIN, webUrl: '', source: 'own' });
  });
});

describe('pairDevice: a code that cannot be one, an origin that is not one', () => {
  it('refuses a malformed code as bad_code without sending anything', async () => {
    for (const code of ['', 'ABCD-EFG0', 'ABCDEFGHJ']) {
      const { result, transport } = await pairWith(jsonReply(200, ANSWER), { code });
      expect(result).toEqual({ ok: false, reason: 'bad_code' });
      expect(transport.calls).toHaveLength(0);
    }
  });

  it('throws before sending to an origin parseServerAddress would not give', async () => {
    for (const origin of [
      'http://203.0.113.5',
      'automatos.example.test',
      `${ORIGIN}/`,
      'http://localhost',
    ]) {
      const transport = answering(jsonReply(200, ANSWER));
      await expect(pairDevice({ ...INPUT, origin }, { transport })).rejects.toThrow(RangeError);
      expect(transport.calls).toHaveLength(0);
    }
  });
});

describe('pairDevice: the answer', () => {
  it('hands back the paired device, token included, and nothing else', async () => {
    const { result } = await pairWith(jsonReply(200, { ...ANSWER, extra: 'ignored' }));
    expect(result).toEqual({
      ok: true,
      device: {
        deviceId: ANSWER.device_id,
        workspaceId: ANSWER.workspace_id,
        token: TOKEN,
        rotateAfter: ANSWER.rotate_after,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ['no token', { ...ANSWER, token: undefined }],
    ['a token without amd_', { ...ANSWER, token: TOKEN.replace('amd_', 'ak_x') }],
    ['a short amd_ token', { ...ANSWER, token: 'amd_short' }],
    ['a token that could split a header', { ...ANSWER, token: `${TOKEN}\r\nX: y` }],
    ['a device id that is not a uuid', { ...ANSWER, device_id: '42' }],
    ['rotate_after that is not a datetime', { ...ANSWER, rotate_after: 'tomorrow' }],
  ])('reads %s as invalid_response', async (_label, body) => {
    const { result } = await pairWith(jsonReply(200, body));
    expect(result).toEqual({ ok: false, reason: 'invalid_response' });
  });

  it('reads a body that is not JSON as invalid_response', async () => {
    const { result } = await pairWith(reply(200, '<html>proxy login</html>'));
    expect(result).toEqual({ ok: false, reason: 'invalid_response' });
  });
});

describe('pairDevice: refusals', () => {
  it.each([
    [401, { detail: { code: 'invalid_pairing_code' } }, 'bad_code'],
    [401, { detail: 'Invalid or expired token' }, 'refused'],
    [404, { detail: 'Not Found' }, 'pairing_off'],
    [429, { detail: 'Too many pairing attempts from this address. Try again later.' }, 'too_many'],
    [409, { detail: 'This device changed at the same moment. Try again.' }, 'busy'],
    [500, {}, 'busy'],
    [502, {}, 'busy'],
    [503, { detail: 'Pairing is unavailable right now. Try again in a minute.' }, 'busy'],
    [400, { detail: 'nope' }, 'refused'],
    [403, { detail: 'nope' }, 'refused'],
    [422, { detail: [{ loc: ['body', 'install_id'] }] }, 'refused'],
  ])('%i %j → %s', async (status, body, reason) => {
    const { result } = await pairWith(jsonReply(status, body));
    expect(result).toEqual({ ok: false, reason });
  });

  it('reads a transport failure as unreachable', async () => {
    const transport = answering(() => {
      throw new TypeError('Network request failed');
    });
    expect(await pairDevice(INPUT, { transport })).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reads no answer within the timeout as unreachable', async () => {
    vi.useFakeTimers();
    try {
      const transport = fakeTransport(hangUntilAborted);
      const pending = pairDevice(INPUT, { transport });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await pending).toEqual({ ok: false, reason: 'unreachable' });
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws the caller's abort instead of calling it a refusal", async () => {
    const controller = new AbortController();
    const transport = fakeTransport(hangUntilAborted);
    const pending = pairDevice(INPUT, { transport, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it("a wrong code's 401 never reaches a signed-in session's expiry callback", async () => {
    const sessionExpired = vi.fn();
    const shared = answering(
      reply(401, JSON.stringify({ detail: { code: 'invalid_pairing_code' } })),
    );
    createApiClient({
      server: { apiUrl: ORIGIN, webUrl: '', source: 'own' },
      getToken: async () => TOKEN,
      getWorkspaceId: () => ANSWER.workspace_id,
      transport: shared,
      onAuthExpired: sessionExpired,
    });
    const result = await pairDevice(INPUT, { transport: shared });
    expect(result).toEqual({ ok: false, reason: 'bad_code' });
    expect(sessionExpired).not.toHaveBeenCalled();
  });
});

describe('pairRefusalFor', () => {
  it('maps the kinds with no status', () => {
    expect(pairRefusalFor(new ApiError('network'))).toBe('unreachable');
    expect(pairRefusalFor(new ApiError('invalid_response'))).toBe('invalid_response');
    expect(pairRefusalFor(new ApiError('auth'))).toBe('refused');
  });
});

describe('pairResponseSchema', () => {
  it('drops unknown fields', () => {
    expect(pairResponseSchema.parse({ ...ANSWER, previous_token_valid_until: 'x' })).toEqual(
      ANSWER,
    );
  });

  it("accepts the server's isoformat with and without fractions, and Z", () => {
    for (const rotate_after of ['2027-01-19T10:00:00+00:00', '2027-01-19T10:00:00Z']) {
      expect(pairResponseSchema.safeParse({ ...ANSWER, rotate_after }).success).toBe(true);
    }
  });
});

describe('nothing is logged', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pairing, or failing to, writes nothing to the console (the logger is its only user)', async () => {
    const spies = consoleMethods.map((method) => vi.spyOn(console, method));
    await pairWith(jsonReply(200, ANSWER));
    await pairWith(jsonReply(401, { detail: { code: 'invalid_pairing_code' } }));
    await pairWith(jsonReply(200, { ...ANSWER, token: 'nope' }));
    await pairWith(jsonReply(503, {}));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
