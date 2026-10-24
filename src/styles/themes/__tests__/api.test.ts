// The theme reads over the one client (D-ONE-CLIENT), through the foundation's real client and a
// fake transport: the shapes core main sends (schemas.ts, unknown fields ignored), a 404 for /active
// read as Studio, a 404 for one painting as null, every other failure the taxonomy's ApiError, the
// install id in its own path segment, the bearer and workspace on every call.

import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../api/client';
import { isApiError } from '../../../api/errors';
import { logger } from '../../../lib/logger';
import { SERVER, fakeTransport, jsonReply, reply } from '../../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../../api/transport-types';
import { themeReader } from '../api';
import { NO_ACTIVE_THEME } from '../schemas';
import { DAY_TOKENS, FONT_URL, HARBOUR_ID, MOSS_ID } from './fixtures';

type Responder = (request: TransportRequest) => ReturnType<typeof reply>;

function readerOver(responder: Responder) {
  const transport = fakeTransport(responder);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token-1',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return { reader: themeReader(client), calls: transport.calls };
}

const INSTALL_ROW = {
  installId: HARBOUR_ID,
  themeId: 'acme/harbour',
  name: 'Harbour',
  packageId: 'pkg-1',
  version: '1.1.0',
  ownerType: 'marketplace',
  reviewed: true,
  optIn: { required: false, wording: 'Run it?', packageId: 'pkg-1' },
  revoked: null,
  signature: { state: 'verified', keyId: 'k1' },
};

const MOBILE_ANSWER = {
  schema: 1,
  installId: HARBOUR_ID,
  themeId: 'acme/harbour',
  version: '1.1.0',
  mobile: {
    source: 'tokens',
    tone: null,
    tokens: { light: DAY_TOKENS, dark: null },
    fonts: { sans: FONT_URL, fantasy: FONT_URL },
    mascot: { mode: 'none', states: [] },
    future: 'ignored',
  },
};

describe('GET /api/themes/active', () => {
  it("reads core's answer, a 'warn' theme and the withdrawn shape", async () => {
    const { reader, calls } = readerOver(() =>
      jsonReply(200, {
        choice: HARBOUR_ID,
        source: 'default',
        theme: {
          installId: HARBOUR_ID,
          themeId: 'acme/harbour',
          version: '1.1.0',
          manifest: { name: 'Harbour' },
          revoked: { level: 'warn', reason: 'old' },
        },
      }),
    );
    const active = await reader.active();
    expect(active.theme?.revoked).toEqual({ level: 'warn', reason: 'old' });
    expect(calls[0].url).toBe(`${SERVER.apiUrl}/api/themes/active`);
    expect(calls[0].headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'X-Workspace-ID': 'ws-1',
    });
    const withdrawn = readerOver(() =>
      jsonReply(200, {
        choice: 'studio',
        source: 'choice',
        theme: null,
        revoked: { installId: HARBOUR_ID, level: 'disable', reason: 'malware' },
      }),
    );
    expect((await withdrawn.reader.active()).revoked).toEqual({
      installId: HARBOUR_ID,
      level: 'disable',
      reason: 'malware',
    });
  });

  it('reads a server without theme routes (404) as Studio', async () => {
    const { reader } = readerOver(() => reply(404, '{"detail":"Not Found"}'));
    expect(await reader.active()).toEqual(NO_ACTIVE_THEME);
  });

  it('throws the taxonomy error for anything else', async () => {
    const { reader } = readerOver(() => reply(503));
    const error = await reader.active().catch((caught: unknown) => caught);
    expect(isApiError(error) && error.kind).toBe('server');
  });
});

describe('GET /api/themes/installed', () => {
  it('reads each row and drops one it cannot read, alone, logged', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { reader } = readerOver(() =>
      jsonReply(200, {
        installs: [
          INSTALL_ROW,
          { installId: '../x', themeId: 'a/b', version: '1' },
          { ...INSTALL_ROW, installId: MOSS_ID, revoked: { level: 'nuke' } },
        ],
      }),
    );
    const rows = await reader.installed();
    expect(rows.map((r) => r.installId)).toEqual([HARBOUR_ID, MOSS_ID]);
    expect(rows[0]).toEqual({
      installId: HARBOUR_ID,
      themeId: 'acme/harbour',
      name: 'Harbour',
      version: '1.1.0',
      optIn: { required: false, wording: 'Run it?', packageId: 'pkg-1' },
      revoked: null,
    });
    expect(rows[1].revoked).toEqual({ level: 'disable', reason: null });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 install row'));
    vi.restoreAllMocks();
  });

  it('fails as invalid_response when the envelope is not the shape', async () => {
    const { reader } = readerOver(() => jsonReply(200, [INSTALL_ROW]));
    const error = await reader.installed().catch((caught: unknown) => caught);
    expect(isApiError(error) && error.kind).toBe('invalid_response');
  });
});

describe('GET /api/themes/mobile/{install_id}', () => {
  it('asks for the install in its own path segment and reads the answer, unknown fields ignored', async () => {
    const { reader, calls } = readerOver(() => jsonReply(200, MOBILE_ANSWER));
    const answer = await reader.mobile(HARBOUR_ID);
    expect(calls[0].url).toBe(`${SERVER.apiUrl}/api/themes/mobile/${HARBOUR_ID}`);
    expect(answer?.mobile?.fonts).toEqual({ sans: FONT_URL });
    expect(answer?.mobile).not.toHaveProperty('future');
  });

  it('is null on a 404 (unknown, foreign or gone)', async () => {
    const { reader } = readerOver(() => reply(404, '{"detail":"This theme isn\'t installed."}'));
    expect(await reader.mobile(HARBOUR_ID)).toBeNull();
  });

  it('refuses an answer of another schema version, and throws a 401 as auth', async () => {
    const newer = readerOver(() => jsonReply(200, { ...MOBILE_ANSWER, schema: 2 }));
    const refused = await newer.reader.mobile(HARBOUR_ID).catch((caught: unknown) => caught);
    expect(isApiError(refused) && refused.kind).toBe('invalid_response');
    const expired = readerOver(() => reply(401));
    const error = await expired.reader.mobile(HARBOUR_ID).catch((caught: unknown) => caught);
    expect(isApiError(error) && error.kind).toBe('auth');
  });

  it('reads a null block, and a mascot it cannot read as none', async () => {
    const none = readerOver(() => jsonReply(200, { ...MOBILE_ANSWER, mobile: null }));
    expect((await none.reader.mobile(HARBOUR_ID))?.mobile).toBeNull();
    const odd = readerOver(() =>
      jsonReply(200, { ...MOBILE_ANSWER, mobile: { ...MOBILE_ANSWER.mobile, mascot: 'clips' } }),
    );
    expect((await odd.reader.mobile(HARBOUR_ID))?.mobile?.mascot).toEqual({
      mode: 'none',
      states: [],
    });
  });
});
