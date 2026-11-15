// The real transport's wiring (transport.ts), over a stand-in for expo/fetch: what the client asks
// for is what is sent, and the two ways a body is read (whole as bytes under a cap, or as it
// arrives) each read the response that came back, with the response's own Content-Length handed to
// the cap. Every other test injects a fake transport, so without this one the wiring could be lost
// and nothing would say so.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BodyTooLargeError } from '../body';
import type { TransportRequest } from '../transport-types';
import { streamOf } from './fake-transport';

type Sent = { readonly url: string; readonly init: Record<string, unknown> };

const native = vi.hoisted(() => ({
  sent: [] as { url: string; init: Record<string, unknown> }[],
  answer: null as unknown,
}));

vi.mock('expo/fetch', () => ({
  fetch: async (url: string, init: Record<string, unknown>) => {
    native.sent.push({ url, init });
    return native.answer;
  },
}));

const { expoTransport } = await import('../transport');

const BODY = '{"a":1}';
const BYTES = new TextEncoder().encode(BODY);
const ROOM = 1024;

function answerWith(headers: Record<string, string> = {}, status = 200) {
  const byName = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  native.answer = {
    status,
    body: streamOf(BYTES),
    headers: { get: (name: string) => byName.get(name.toLowerCase()) ?? null },
  };
}

function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    url: 'https://api.example.test/api/workspaces/current',
    method: 'GET',
    headers: {},
    signal: new AbortController().signal,
    ...overrides,
  };
}

beforeEach(() => {
  native.sent.length = 0;
  answerWith();
});

describe('the real transport', () => {
  it('sends what the client prepared: the address, the method, the headers, the body, the signal', async () => {
    const asked = request({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await expoTransport.request(asked);
    const sent: Sent | undefined = native.sent[0];
    expect(native.sent).toHaveLength(1);
    expect(sent?.url).toBe(asked.url);
    expect(sent?.init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: asked.signal,
    });
  });

  it.each(['request', 'stream', 'binary'] as const)(
    '%s keeps the status and reads the body whole, as bytes under the cap it is given',
    async (call) => {
      answerWith({}, 201);
      const response = await expoTransport[call](request());
      expect(response.status).toBe(201);
      expect(new TextDecoder().decode(await response.bytes(ROOM))).toBe(BODY);
    },
  );

  it.each(['request', 'stream', 'binary'] as const)(
    '%s refuses a body one byte over its cap',
    async (call) => {
      const response = await expoTransport[call](request());
      await expect(response.bytes(BYTES.byteLength - 1)).rejects.toBeInstanceOf(BodyTooLargeError);
    },
  );

  it.each(['request', 'stream', 'binary'] as const)(
    "%s hands the response's Content-Length to the cap, so an oversized answer is refused unread",
    async (call) => {
      answerWith({ 'Content-Length': String(ROOM + 1) });
      const response = await expoTransport[call](request());
      await expect(response.bytes(ROOM)).rejects.toBeInstanceOf(BodyTooLargeError);
    },
  );

  it('has no way to read a body whole without a cap', async () => {
    const response = await expoTransport.request(request());
    expect(Object.keys(response).sort()).toEqual(['bytes', 'chunks', 'status']);
    const binary = await expoTransport.binary(request());
    expect(Object.keys(binary).sort()).toEqual(['bytes', 'header', 'status']);
  });

  it('stream reads the body as it arrives', async () => {
    const response = await expoTransport.stream(request());
    let text = '';
    for await (const chunk of response.chunks()) text += chunk;
    expect(text).toBe(BODY);
  });

  it('binary reads a header by name, in any case, and null when there is none', async () => {
    answerWith({ 'X-Voice-Id': 'v1' });
    const response = await expoTransport.binary(request());
    expect(response.header('x-voice-id')).toBe('v1');
    expect(response.header('X-Voice-Id')).toBe('v1');
    expect(response.header('missing')).toBeNull();
  });
});
