// The connect flow's two calls over fake ports (US-006e): discovery at the origin being checked,
// and the pairing — `paired` only once POST /pair answered and connectTo saved the record (KC8),
// with the token handed to connectTo and nowhere else (KC9).

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
} from '../../api/__tests__/fake-transport';
import { DiscoverySchema } from '../../api/discovery';
import { hostedServerFrom, type Server } from '../../api/server';
import type { TransportRequest } from '../../api/transport-types';
import { confirmDetailsFrom, type ConfirmDetails } from '../confirm';
import { discover, pair, type ConnectPorts } from '../connect-steps';
import type { PairedRecord } from '../device-store';
import { TOKEN } from './paired-record';

const LAN = 'http://192.168.1.20:8000';
const HOSTED_API = 'https://api.automatos.app';
const HOSTED = hostedServerFrom({ apiUrl: HOSTED_API, webUrl: 'https://ui.automatos.app' });
const NOW = new Date('2026-10-23T09:30:00.000Z');

const LOCAL_DOCUMENT = {
  schema: 'automatos-discovery/v1',
  name: 'Automatos',
  edition: 'local',
  api_url: LAN,
  web_url: 'http://192.168.1.20:3000',
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
  push: { expo: false },
  capabilities: ['spoken_mode'],
};

const ANSWER = {
  device_id: '4a0f6c5e-8f43-4d5e-9b7a-1f2e3d4c5b6a',
  workspace_id: '9b1d2c3e-4f50-4617-8a9b-0c1d2e3f4a5b',
  token: TOKEN,
  rotate_after: '2027-01-19T10:00:00.123456+00:00',
};

const DETAILS: ConfirmDetails = confirmDetailsFrom(
  { origin: LAN, insecure: true, code: 'ABCD-EFGH' },
  DiscoverySchema.parse(LOCAL_DOCUMENT),
);

type Responder = (request: TransportRequest) => ReturnType<typeof reply> | Promise<never>;

function ports(responder: Responder, overrides: Partial<ConnectPorts> = {}) {
  const transport = fakeTransport(responder);
  const saved: PairedRecord[] = [];
  const all: ConnectPorts = {
    transport,
    hosted: HOSTED as Server,
    installId: async () => 'AAECAwQFBgcICQoLDA0ODw',
    device: { name: 'Automatos Go on iPhone', platform: 'ios', appVersion: '1.0.0' },
    connectTo: vi.fn(async (record: PairedRecord) => {
      saved.push(record);
    }),
    now: () => NOW,
    ...overrides,
  };
  return { ports: all, transport, saved };
}

const consoleMethods = ['log', 'info', 'warn', 'error'] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discover', () => {
  it('reads the document at the origin, with no credential, and names the next step', async () => {
    const { ports: deps, transport } = ports(() => jsonReply(200, LOCAL_DOCUMENT));
    const action = await discover(LAN, deps);
    expect(action).toMatchObject({ type: 'discovered', origin: LAN, next: 'pair' });
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.url).toBe(`${LAN}/.well-known/automatos.json`);
    const headers = Object.keys(transport.calls[0]?.headers ?? {}).map((h) => h.toLowerCase());
    expect(headers).not.toContain('authorization');
    expect(headers).not.toContain('x-workspace-id');
  });

  it('names pairing_off for a server that has pairing off', async () => {
    const off = { ...LOCAL_DOCUMENT, pairing: { enabled: false } };
    const { ports: deps } = ports(() => jsonReply(200, off));
    expect(await discover(LAN, deps)).toMatchObject({ next: 'pairing_off' });
  });

  it("reads the built-in hosted server's 404 as its defaults: a sign-in (K3)", async () => {
    const { ports: deps } = ports(() => reply(404, 'Not Found'));
    expect(await discover(HOSTED_API, deps)).toMatchObject({ next: 'hosted' });
  });

  it.each([
    ['no answer', () => Promise.reject(new TypeError('Network request failed')), 'unreachable'],
    ['a gateway that cannot reach it', () => reply(502), 'unreachable'],
    ['no document', () => reply(404, 'Not Found'), 'no_discovery'],
    ['a web page', () => reply(200, '<html>router login</html>'), 'not_automatos'],
    [
      'another schema',
      () => jsonReply(200, { ...LOCAL_DOCUMENT, schema: 'x/v9' }),
      'not_automatos',
    ],
    ['a misconfigured server', () => jsonReply(500, { detail: 'not set up' }), 'discovery_failed'],
  ] as const)('fails on %s', async (_label, responder, kind) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports: deps } = ports(responder as Responder);
    expect(await discover(LAN, deps)).toEqual({ type: 'discoveryFailed', origin: LAN, kind });
  });

  it('feeds nothing back once Back aborted it', async () => {
    const { ports: deps } = ports(hangUntilAborted);
    const controller = new AbortController();
    const running = discover(LAN, deps, controller.signal);
    controller.abort();
    expect(await running).toBeNull();
  });
});

describe('pair', () => {
  it('sends the code once, saves the whole record, then reports it without the token', async () => {
    const { ports: deps, transport, saved } = ports(() => jsonReply(200, ANSWER));
    const action = await pair(DETAILS, deps);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.url).toBe(`${LAN}/api/v1/mobile/pair`);
    expect(JSON.parse(String(transport.calls[0]?.body))).toMatchObject({
      code: 'ABCD-EFGH',
      install_id: 'AAECAwQFBgcICQoLDA0ODw',
      platform: 'ios',
    });
    expect(saved).toEqual([
      {
        origin: LAN,
        webUrl: 'http://192.168.1.20:3000',
        serverName: 'Automatos',
        edition: 'local',
        insecure: true,
        pushExpo: false,
        deviceId: ANSWER.device_id,
        workspaceId: ANSWER.workspace_id,
        token: TOKEN,
        rotateAfter: ANSWER.rotate_after,
        pairedAt: NOW.toISOString(),
      },
    ]);
    expect(action.type).toBe('paired');
    expect(JSON.stringify(action)).not.toContain(TOKEN);
  });

  it('is paired only after connectTo has finished', async () => {
    let finish: () => void = () => undefined;
    const connectTo = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { ports: deps } = ports(() => jsonReply(200, ANSWER), { connectTo });
    let settled = false;
    const running = pair(DETAILS, deps).then((action) => {
      settled = true;
      return action;
    });
    await vi.waitFor(() => expect(connectTo).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    finish();
    expect((await running).type).toBe('paired');
  });

  it.each([
    [401, { detail: { code: 'invalid_pairing_code' } }, 'bad_code'],
    [404, { detail: 'Not Found' }, 'pairing_off'],
    [429, { detail: 'Too many' }, 'too_many'],
    [409, { detail: 'busy' }, 'busy'],
  ] as const)('reports a %s refusal and saves nothing', async (status, body, kind) => {
    const { ports: deps, saved } = ports(() => jsonReply(status, body));
    expect(await pair(DETAILS, deps)).toEqual({ type: 'pairFailed', kind });
    expect(saved).toHaveLength(0);
  });

  it('sends nothing when the keychain will not give the install id', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const installId = async () => {
      throw new Error('User interaction is not allowed');
    };
    const { ports: deps, transport } = ports(() => jsonReply(200, ANSWER), { installId });
    expect(await pair(DETAILS, deps)).toEqual({ type: 'pairFailed', kind: 'keychain' });
    expect(transport.calls).toHaveLength(0);
  });

  it('reports not_saved when the switch or the save fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const connectTo = vi.fn(async () => {
      throw new Error('not a paired record (webUrl: custom)');
    });
    const { ports: deps } = ports(() => jsonReply(200, ANSWER), { connectTo });
    expect(await pair(DETAILS, deps)).toEqual({ type: 'pairFailed', kind: 'not_saved' });
  });

  it('logs neither the token nor the code, whatever happens', async () => {
    const spies = consoleMethods.map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const failing = vi.fn(async () => {
      throw new Error('keychain write failed');
    });
    await pair(DETAILS, ports(() => jsonReply(200, ANSWER)).ports);
    await pair(DETAILS, ports(() => jsonReply(200, ANSWER), { connectTo: failing }).ports);
    await pair(DETAILS, ports(() => jsonReply(401, { detail: { code: 'x' } })).ports);
    const logged = JSON.stringify(
      spies.flatMap((spy) => spy.mock.calls),
      (_key, value) => (value instanceof Error ? value.message : value),
    );
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('ABCD-EFGH');
  });
});
