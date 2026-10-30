// Auto's server voice over the one API client: the voices parsed with zod (each on its own, in the
// server's order), one MP3 per sentence, every refusal and failure as its kind, and nothing about
// the bearer in a URL, an error or a log.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError, isAbortError } from '../../api/errors';
import {
  SERVER,
  bytesReply,
  fakeTransport,
  hangUntilAborted,
  jsonReply,
  reply,
  type FakeResponse,
} from '../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../api/transport-types';
import { servedAtPin } from '../../api/__tests__/served';
import { logger } from '../../lib/logger';
import { SERVER_VOICE_MAX_BYTES } from '../config';
import { VOICE_ROUTES } from '../routes';
import {
  SpeechFailure,
  fetchServerVoices,
  fetchSpeech,
  speechFailureKind,
  type SpeechAsk,
} from '../server/voice-api';

const TOKEN = 'secret.bearer.token';
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04]);
const ASK: SpeechAsk = { text: 'Two meetings today.', voice: 'af_heart', speed: 1.1 };

function clientFor(answer: (request: TransportRequest) => FakeResponse | Promise<FakeResponse>) {
  const transport = fakeTransport(answer);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => TOKEN,
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return { client, transport };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => error,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the voice routes', () => {
  it('are the server contract, on the server at the core pin with no pendingUpstream mark', () => {
    expect(VOICE_ROUTES.speech).toEqual({ method: 'POST', path: '/api/voice/speech' });
    expect(VOICE_ROUTES.voices).toEqual({ method: 'GET', path: '/api/voice/voices' });
    expect(servedAtPin(VOICE_ROUTES.speech)).toBe(true);
    expect(servedAtPin(VOICE_ROUTES.voices)).toBe(true);
  });
});

describe('fetchServerVoices', () => {
  it("parses each voice on its own, in the server's order, unknown fields ignored", async () => {
    const { client, transport } = clientFor(() =>
      jsonReply(200, {
        default: 'af_heart',
        voices: [
          { id: 'af_heart', name: 'Heart', accent: 'en-US', gender: 'female', extra: 1 },
          { id: '', name: 'Nameless' },
          { id: 'bm_george', name: 'George', accent: 'British English' },
          'not a voice',
          { id: 'x', name: 'X', accent: 42 },
        ],
      }),
    );
    expect(await fetchServerVoices(client)).toEqual({
      defaultId: 'af_heart',
      voices: [
        { id: 'af_heart', name: 'Heart', accent: 'en-US', gender: 'female' },
        { id: 'bm_george', name: 'George', accent: 'British English', gender: null },
        { id: 'x', name: 'X', accent: null, gender: null },
      ],
    });
    expect(transport.calls[0]?.url).toBe(`${SERVER.apiUrl}/api/voice/voices`);
    expect(transport.calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('reads no default as null, and a list that is not one as invalid_response', async () => {
    const none = clientFor(() => jsonReply(200, { voices: [] }));
    expect(await fetchServerVoices(none.client)).toEqual({ defaultId: null, voices: [] });
    const bad = clientFor(() => jsonReply(200, { voices: 'Heart' }));
    expect(await failureOf(fetchServerVoices(bad.client))).toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('rejects with the 503 when the server has no voice', async () => {
    const { client } = clientFor(() => jsonReply(503, { code: 'tts_off', detail: 'No voice.' }));
    const error = await failureOf(fetchServerVoices(client));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'tts_off' });
  });
});

describe('fetchSpeech', () => {
  it('posts the sentence, voice and speed as JSON and answers the MP3', async () => {
    const { client, transport } = clientFor(() =>
      bytesReply(200, MP3, { 'Content-Type': 'audio/mpeg', 'X-Voice-Id': 'af_heart' }),
    );
    const bytes = await fetchSpeech(client, ASK, new AbortController().signal);
    expect([...bytes]).toEqual([...MP3]);
    const sent = transport.calls[0];
    expect(sent?.method).toBe('POST');
    expect(sent?.url).toBe(`${SERVER.apiUrl}/api/voice/speech`);
    expect(JSON.parse(String(sent?.body))).toEqual({
      text: 'Two meetings today.',
      voice: 'af_heart',
      speed: 1.1,
    });
    expect(sent?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it.each([
    [503, 'tts_off'],
    [503, 'tts_unavailable'],
    [422, 'tts_bad_request'],
    [413, 'tts_too_long'],
    [429, 'tts_busy'],
  ] as const)('a %i %s refusal is that kind', async (status, code) => {
    const { client } = clientFor(() => jsonReply(status, { code, detail: 'Words.' }));
    const error = await failureOf(fetchSpeech(client, ASK, new AbortController().signal));
    expect(error).toBeInstanceOf(SpeechFailure);
    expect(error).toMatchObject({ kind: code });
  });

  it('any other failure is the taxonomy: auth, network or refused', () => {
    expect(speechFailureKind(new ApiError('auth', { status: 401 }))).toBe('auth');
    expect(speechFailureKind(new ApiError('network'))).toBe('network');
    expect(speechFailureKind(new ApiError('server', { status: 500 }))).toBe('refused');
    expect(speechFailureKind(new ApiError('server', { status: 400, code: 'other' }))).toBe(
      'refused',
    );
    expect(speechFailureKind(new TypeError('offline'))).toBe('network');
  });

  it.each([
    ['not audio', () => bytesReply(200, MP3, { 'Content-Type': 'text/html' })],
    ['no content type', () => bytesReply(200, MP3)],
    ['empty', () => bytesReply(200, new Uint8Array(), { 'Content-Type': 'audio/mpeg' })],
    [
      'too large',
      () =>
        bytesReply(200, new Uint8Array(SERVER_VOICE_MAX_BYTES + 1), {
          'Content-Type': 'audio/mpeg',
        }),
    ],
    [
      'declared too large',
      () =>
        bytesReply(200, MP3, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(SERVER_VOICE_MAX_BYTES + 1),
        }),
    ],
  ])('a 200 that is %s is invalid_audio', async (_name, answer) => {
    const { client } = clientFor(answer);
    const error = await failureOf(fetchSpeech(client, ASK, new AbortController().signal));
    expect(error).toMatchObject({ kind: 'invalid_audio' });
  });

  it("keeps the caller's abort an AbortError, not a failure", async () => {
    const { client } = clientFor(hangUntilAborted);
    const controller = new AbortController();
    const pending = fetchSpeech(client, ASK, controller.signal);
    controller.abort();
    const error = await failureOf(pending);
    expect(isAbortError(error)).toBe(true);
  });
});

describe('the bearer and the sentence stay out of URLs, errors and logs', () => {
  it('for every way a request can fail', async () => {
    const logged: unknown[][] = [];
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(logger, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    const answers: (() => FakeResponse | Promise<FakeResponse>)[] = [
      () => jsonReply(429, { code: 'tts_busy', detail: 'Busy.' }),
      () => reply(500, 'Internal error'),
      () => Promise.reject(new TypeError('Network request failed')),
      () => bytesReply(200, MP3, { 'Content-Type': 'text/plain' }),
    ];
    for (const answer of answers) {
      const { client, transport } = clientFor(answer);
      const error = await failureOf(fetchSpeech(client, ASK, new AbortController().signal));
      expect(String(error)).not.toContain(TOKEN);
      expect(String(error)).not.toContain(ASK.text);
      expect(transport.calls[0]?.url).not.toContain(TOKEN);
    }
    const everything = JSON.stringify(logged.map((args) => args.map(String)));
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain(ASK.text);
  });
});
