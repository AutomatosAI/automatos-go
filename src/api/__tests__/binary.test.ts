// The client's binary(): a body that is not JSON (Auto's server voice, one MP3) read whole as
// bytes with its headers, through the same bearer, workspace header, error taxonomy, timeout and
// abort as every other call; and the launch client's 403 report on it.

import { describe, expect, it, vi } from 'vitest';

import { createLaunchClient } from '../../app-state/launch-client';
import { createApiClient, type ApiClientOptions } from '../client';
import { ApiError, isAbortError } from '../errors';
import type { Route } from '../routes';
import {
  SERVER,
  bytesReply,
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
  type FakeTransport,
} from './fake-transport';

const SPEECH: Route = { method: 'POST', path: '/api/voice/speech' };
const TOKEN = 'jwt.token.value';
const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);

function clientWith(transport: FakeTransport, overrides: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    server: SERVER,
    getToken: async () => TOKEN,
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
    ...overrides,
  });
}

describe('binary', () => {
  it('posts JSON through transport.binary with the bearer and workspace header', async () => {
    const transport = fakeTransport(() => bytesReply(200, MP3, { 'X-Voice-Id': 'af_heart' }));
    const body = await clientWith(transport).binary(SPEECH, { body: { text: 'Hi.' } });
    expect([...body.bytes]).toEqual([...MP3]);
    expect(body.header('x-voice-id')).toBe('af_heart');
    expect(body.header('Content-Type')).toBeNull();
    const sent = transport.calls[0];
    expect(sent?.url).toBe(`${SERVER.apiUrl}/api/voice/speech`);
    expect(sent?.url).not.toContain(TOKEN);
    expect(sent?.method).toBe('POST');
    expect(sent?.body).toBe('{"text":"Hi."}');
    expect(sent?.headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      'X-Workspace-ID': WORKSPACE_ID,
      'Content-Type': 'application/json',
    });
  });

  it('maps a refusal to the taxonomy with the code beside its detail', async () => {
    const transport = fakeTransport(() =>
      jsonReply(429, { code: 'tts_busy', detail: 'The voice is busy.' }),
    );
    const error = await clientWith(transport)
      .binary(SPEECH)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', status: 429, code: 'tts_busy' });
    expect(String((error as Error).message)).not.toContain(TOKEN);
  });

  it('gives up after its own timeout as a network error, aborting the request', async () => {
    const transport = fakeTransport(hangUntilAborted);
    const error = await clientWith(transport, { timeoutMs: 60_000 })
      .binary(SPEECH, { timeoutMs: 5 })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'network' });
    expect(String(((error as ApiError).cause as Error).message)).toContain('within 5 ms');
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it("rejects with an AbortError on the caller's abort", async () => {
    const transport = fakeTransport(hangUntilAborted);
    const controller = new AbortController();
    const pending = clientWith(transport).binary(SPEECH, { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
  });

  it('reads a body without bytes of its own as its text, for the fakes', async () => {
    const body = await clientWith(fakeTransport(() => reply(200, 'ab'))).binary(SPEECH);
    expect([...body.bytes]).toEqual([0x61, 0x62]);
  });
});

describe('the launch client', () => {
  it("reports binary()'s 403 to the session's refusals, then rethrows it", async () => {
    const report = vi.fn();
    const client = createLaunchClient({
      server: SERVER,
      clientAuth: { getToken: async () => TOKEN, onAuthExpired: vi.fn() },
      workspaceIds: { get: () => WORKSPACE_ID },
      transport: fakeTransport(() => jsonReply(403, { detail: 'No.' })),
      refusals: { report },
    });
    const error = await client.binary(SPEECH).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'forbidden' });
    expect(report).toHaveBeenCalledWith(error);
  });
});
