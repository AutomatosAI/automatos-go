import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  DiscoverySchema,
  fetchDiscovery,
  hostedDefaults,
  type Discovery,
} from '../discovery';
import { ApiError } from '../errors';
import type { Server } from '../server';
import { SERVER, fakeTransport, jsonReply, reply } from './fake-transport';

/** PRD-266 §4.1's example document, as the server will send it. */
const SAAS_DOCUMENT = {
  schema: 'automatos-discovery/v1',
  name: 'Automatos',
  edition: 'saas',
  api_url: 'https://api.automatos.app',
  web_url: 'https://ui.automatos.app',
  auth: {
    modes: ['clerk'],
    clerk: { publishable_key: 'pk_live_example', frontend_api: 'clerk.automatos.app' },
  },
  pairing: { enabled: false },
  push: { expo: true },
  capabilities: ['push', 'spoken_mode', 'voice_live', 'mobile_theme', 'report_content', 'digest'],
};

const LOCAL_DOCUMENT = {
  schema: 'automatos-discovery/v1',
  name: 'Automatos',
  edition: 'local',
  api_url: 'http://192.168.1.20:8000',
  web_url: 'http://192.168.1.20:3000',
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
  push: { expo: false },
  capabilities: ['spoken_mode'],
};

/** A self-hosted install connected by QR (US-006); not a ServerSource yet in this wave. */
/** An own server (KC4) at the same address: K3's defaults are the built-in server's only. */
const OWN_SERVER: Server = { ...SERVER, source: 'own' };

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

function parse(value: unknown): Discovery {
  return DiscoverySchema.parse(value);
}

describe('DiscoverySchema', () => {
  it('reads the full SaaS document of PRD-266 §4.1', () => {
    expect(parse(SAAS_DOCUMENT)).toEqual(SAAS_DOCUMENT);
  });

  it('reads a local install: device sign-in, no Clerk, pairing on', () => {
    const discovery = parse(LOCAL_DOCUMENT);
    expect(discovery.edition).toBe('local');
    expect(discovery.auth).toEqual({ modes: ['device'], clerk: null });
    expect(discovery.pairing.enabled).toBe(true);
    expect(discovery.capabilities).toEqual(['spoken_mode']);
  });

  it('ignores unknown fields at every level', () => {
    const discovery = parse({
      ...SAAS_DOCUMENT,
      region: 'eu',
      auth: { ...SAAS_DOCUMENT.auth, oidc: { issuer: 'https://id.example.test' } },
      push: { expo: true, fcm: true },
    });
    expect(discovery).not.toHaveProperty('region');
    expect(discovery.auth).not.toHaveProperty('oidc');
    expect(discovery.push).toEqual({ expo: true });
  });

  it('drops capability strings this app does not know, and duplicates', () => {
    const discovery = parse({
      ...SAAS_DOCUMENT,
      capabilities: ['push', 'teleport', 'push', 42, 'digest'],
    });
    expect(discovery.capabilities).toEqual(['push', 'digest']);
  });

  it('keeps unknown sign-in modes, in order, so selection can say the app is too old', () => {
    const discovery = parse({ ...SAAS_DOCUMENT, auth: { modes: ['oidc', 7, 'clerk'] } });
    expect(discovery.auth.modes).toEqual(['oidc', 'clerk']);
    expect(discovery.auth.clerk).toBeNull();
  });

  it('defaults what an older document leaves out to off', () => {
    const { pairing: _p, push: _q, capabilities: _c, ...rest } = SAAS_DOCUMENT;
    const discovery = parse(rest);
    expect(discovery.pairing).toEqual({ enabled: false });
    expect(discovery.push).toEqual({ expo: false });
    expect(discovery.capabilities).toEqual([]);
  });

  it('refuses another schema version and a URL that is not http(s)', () => {
    expect(
      DiscoverySchema.safeParse({ ...SAAS_DOCUMENT, schema: 'automatos-discovery/v2' }).success,
    ).toBe(false);
    expect(
      DiscoverySchema.safeParse({ ...SAAS_DOCUMENT, api_url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('knows exactly the six capabilities of PRD-266 §4.1', () => {
    expect([...CAPABILITIES]).toEqual(SAAS_DOCUMENT.capabilities);
  });
});

describe('fetchDiscovery', () => {
  it('GETs /.well-known/automatos.json with no bearer and no workspace header', async () => {
    const transport = fakeTransport(() => jsonReply(200, SAAS_DOCUMENT));
    const discovery = await fetchDiscovery(SERVER, { transport });
    expect(discovery.capabilities).toHaveLength(6);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.method).toBe('GET');
    expect(transport.calls[0]?.url).toBe(`${SERVER.apiUrl}/.well-known/automatos.json`);
    expect(transport.calls[0]?.headers).toEqual({});
  });

  it('answers the hosted defaults when the built-in server says 404 (K3)', async () => {
    const transport = fakeTransport(() => jsonReply(404, { detail: 'Not Found' }));
    const discovery = await fetchDiscovery(SERVER, { transport });
    expect(discovery).toEqual(hostedDefaults(SERVER));
    expect(discovery.auth.modes).toEqual(['clerk']);
    expect(discovery.capabilities).toEqual([]);
    expect(discovery.api_url).toBe(SERVER.apiUrl);
  });

  it('treats a 404 from any other server as not found, not as hosted', async () => {
    const transport = fakeTransport(() => reply(404));
    const error = await failureOf(fetchDiscovery(OWN_SERVER, { transport }));
    expect(error.kind).toBe('not_found');
  });

  it("reads an own server's document at its origin, with no bearer and no workspace header", async () => {
    const own: Server = { apiUrl: 'http://192.168.1.20:8000', webUrl: '', source: 'own' };
    const transport = fakeTransport(() => jsonReply(200, SAAS_DOCUMENT));
    await fetchDiscovery(own, { transport });
    expect(transport.calls[0]?.url).toBe('http://192.168.1.20:8000/.well-known/automatos.json');
    expect(transport.calls[0]?.headers).toEqual({});
  });

  it('maps a 500 to a server error, never to the defaults', async () => {
    const transport = fakeTransport(() => reply(500, 'boom'));
    const error = await failureOf(fetchDiscovery(SERVER, { transport }));
    expect(error.kind).toBe('server');
    expect(error.status).toBe(500);
  });

  it('maps a network failure to the network kind', async () => {
    const transport = fakeTransport(() => {
      throw new TypeError('Network request failed');
    });
    const error = await failureOf(fetchDiscovery(SERVER, { transport }));
    expect(error.kind).toBe('network');
  });

  it('maps a document it cannot read to invalid_response', async () => {
    const transport = fakeTransport(() => jsonReply(200, { schema: 'something-else' }));
    const error = await failureOf(fetchDiscovery(SERVER, { transport }));
    expect(error.kind).toBe('invalid_response');
  });
});

describe('hostedDefaults', () => {
  it('is SaaS with Clerk only, nothing gated on, and frozen', () => {
    const defaults = hostedDefaults(SERVER);
    expect(defaults).toEqual({
      schema: 'automatos-discovery/v1',
      edition: 'saas',
      api_url: SERVER.apiUrl,
      web_url: SERVER.webUrl,
      auth: { modes: ['clerk'], clerk: null },
      pairing: { enabled: false },
      push: { expo: false },
      capabilities: [],
    });
    expect(Object.isFrozen(defaults)).toBe(true);
    expect(Object.isFrozen(defaults.auth.modes)).toBe(true);
  });
});
