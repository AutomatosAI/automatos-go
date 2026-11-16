import { describe, expect, it } from 'vitest';

import { SERVER_MESSAGE_MAX_CHARS } from '../config';
import {
  abortError,
  ApiError,
  APP_ERROR_CODES,
  detailOf,
  errorFromResponse,
  isAbortError,
  isApiError,
  kindForStatus,
  limitWords,
  userMessage,
  type ApiErrorKind,
} from '../errors';
import { API_ERROR_COPY, APP_ERROR_COPY, LIMIT_COPY } from '../strings';

const KINDS: readonly ApiErrorKind[] = [
  'network',
  'auth',
  'forbidden',
  'not_found',
  'conflict',
  'server',
  'stream',
  'invalid_response',
  'limit',
];

describe('kindForStatus', () => {
  it('names 401, 403, 404, 409 and 429 and calls every other status server', () => {
    expect([401, 403, 404, 409, 429, 500, 503, 400, 402, 422].map(kindForStatus)).toEqual([
      'auth',
      'forbidden',
      'not_found',
      'conflict',
      'limit',
      'server',
      'server',
      'server',
      'server',
      'server',
    ]);
  });
});

describe('detailOf', () => {
  it('reads a string detail as the server message', () => {
    expect(detailOf('{"detail":"Workspace is disabled. Contact an administrator."}')).toEqual({
      serverMessage: 'Workspace is disabled. Contact an administrator.',
    });
  });

  it('reads code and message from an object detail and ignores the rest', () => {
    expect(
      detailOf(JSON.stringify({ detail: { code: 'waitlisted', message: 'You are on the list.' } })),
    ).toEqual({ code: 'waitlisted', serverMessage: 'You are on the list.' });
  });

  it("reads a code beside the detail (the server voice's refusals); the detail's own code wins", () => {
    expect(detailOf(JSON.stringify({ code: 'tts_busy', detail: 'Busy, try again.' }))).toEqual({
      code: 'tts_busy',
      serverMessage: 'Busy, try again.',
    });
    expect(detailOf(JSON.stringify({ code: 'tts_off' }))).toEqual({ code: 'tts_off' });
    expect(detailOf(JSON.stringify({ code: 'outer', detail: { code: 'inner' } }))).toEqual({
      code: 'inner',
    });
    expect(detailOf(JSON.stringify({ code: 7, detail: 'Words.' }))).toEqual({
      serverMessage: 'Words.',
    });
  });

  it("reads a 429's retry_after_seconds beside the detail or in it; the detail's own wins", () => {
    const limited = { code: 'digest_rate_limited', retry_after_seconds: 240 };
    expect(detailOf(JSON.stringify(limited))).toEqual({
      code: 'digest_rate_limited',
      retryAfterSeconds: 240,
    });
    expect(detailOf(JSON.stringify({ detail: limited }))).toEqual({
      code: 'digest_rate_limited',
      retryAfterSeconds: 240,
    });
    expect(
      detailOf(JSON.stringify({ retry_after_seconds: 9, detail: { retry_after_seconds: 30 } })),
    ).toEqual({ retryAfterSeconds: 30 });
    expect(detailOf(JSON.stringify({ retry_after_seconds: 12.5, detail: 'Slow down.' }))).toEqual({
      retryAfterSeconds: 12.5,
      serverMessage: 'Slow down.',
    });
    expect(detailOf(JSON.stringify({ retry_after_seconds: 0 }))).toEqual({ retryAfterSeconds: 0 });
  });

  it('drops a retry_after_seconds that is not a wait: a string, negative, null or missing', () => {
    for (const seconds of ['60', -1, null, true, {}]) {
      expect(
        detailOf(JSON.stringify({ code: 'digest_rate_limited', retry_after_seconds: seconds })),
      ).toEqual({ code: 'digest_rate_limited' });
    }
    expect(detailOf(JSON.stringify({ code: 'digest_rate_limited' }))).toEqual({
      code: 'digest_rate_limited',
    });
  });

  it('carries nothing for a 422 list detail, a non-JSON body or an empty body', () => {
    expect(
      detailOf(JSON.stringify({ detail: [{ loc: ['body'], msg: 'field required' }] })),
    ).toEqual({});
    expect(detailOf('<html>Bad gateway</html>')).toEqual({});
    expect(detailOf('')).toEqual({});
    expect(detailOf('null')).toEqual({});
  });

  it('cuts an over-long server message', () => {
    const long = 'x'.repeat(SERVER_MESSAGE_MAX_CHARS + 50);
    expect(detailOf(JSON.stringify({ detail: long })).serverMessage).toHaveLength(
      SERVER_MESSAGE_MAX_CHARS,
    );
  });
});

describe('ApiError', () => {
  it('carries kind, status, code and server words; its message names no body or URL', () => {
    const error = errorFromResponse(
      409,
      JSON.stringify({ detail: { code: 'pending_invitation', message: 'Accept it first.' } }),
    );
    expect(error).toBeInstanceOf(Error);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'conflict', status: 409, code: 'pending_invitation' });
    expect(error.message).toBe('ApiError conflict 409 pending_invitation');
  });

  it("keeps a 429's wait from its body when it has no Retry-After, and names none without one", () => {
    const limited = errorFromResponse(
      429,
      JSON.stringify({ code: 'digest_rate_limited', retry_after_seconds: 61 }),
    );
    expect(limited).toMatchObject({
      kind: 'limit',
      status: 429,
      code: 'digest_rate_limited',
      retryAfterSeconds: 61,
      retryAt: null,
    });
    expect(limited.message).toBe('ApiError limit 429 digest_rate_limited');
    expect(errorFromResponse(429, '').retryAfterSeconds).toBeUndefined();
    expect(errorFromResponse(429, '').retryAt).toBeNull();
  });

  it('works out when a 429 lifts from its Retry-After and the clock it is given; the header wins', () => {
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    const body = JSON.stringify({ retry_after_seconds: 600 });
    expect(errorFromResponse(429, body, null, { retryAfter: '90', now })).toMatchObject({
      retryAfterSeconds: 90,
      retryAt: now + 90_000,
    });
    const date = { retryAfter: 'Sun, 15 Nov 2026 12:02:00 GMT', now };
    expect(errorFromResponse(429, '', null, date)).toMatchObject({
      retryAfterSeconds: 120,
      retryAt: now + 120_000,
    });
  });

  it('keeps no lift time for any other status, and none past a day', () => {
    const now = Date.UTC(2026, 10, 15, 12, 0, 0);
    expect(errorFromResponse(503, '', null, { retryAfter: '30', now })).toMatchObject({
      kind: 'server',
      retryAt: null,
    });
    expect(errorFromResponse(503, '', null, { retryAfter: '30', now }).retryAfterSeconds).toBe(
      undefined,
    );
    const absurd = errorFromResponse(429, '', null, { retryAfter: '86401', now });
    expect(absurd).toMatchObject({ kind: 'limit', retryAt: null });
    expect(absurd.retryAfterSeconds).toBeUndefined();
  });

  it('leaves a 402 as server: no route the app calls answers one for a limit', () => {
    const body = JSON.stringify({ detail: { code: 'credits_exhausted', message: 'x' } });
    expect(errorFromResponse(402, body)).toMatchObject({ kind: 'server', retryAt: null });
  });

  it('keeps the cause for the logs', () => {
    const cause = new TypeError('Network request failed');
    expect(new ApiError('network', { cause }).cause).toBe(cause);
    expect(new ApiError('network').cause).toBeUndefined();
  });

  it('tells an abort apart from an ApiError', () => {
    expect(isAbortError(abortError())).toBe(true);
    expect(isApiError(abortError())).toBe(false);
    expect(isAbortError(new ApiError('network'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});

describe('userMessage and the copy', () => {
  it('has one message per kind', () => {
    expect(Object.keys(API_ERROR_COPY).sort()).toEqual([...KINDS].sort());
  });

  it.each(KINDS)('%s copy leaks no status code, URL, path or stack', (kind) => {
    const copy = API_ERROR_COPY[kind];
    expect(copy).not.toMatch(/\d/);
    // no digits (status codes, line numbers), no slash (URLs, paths), no newline (stack frames)
    expect(copy).not.toMatch(/https?:|\/|\.json|error:|\n/i);
    expect(userMessage(new ApiError(kind, { status: 500, serverMessage: 'Traceback: boom' }))).toBe(
      kind === 'conflict' ? 'Traceback: boom' : copy,
    );
  });

  it("shows a conflict's own words, and the fixed copy when it sent none", () => {
    expect(userMessage(new ApiError('conflict', { serverMessage: 'Already answered.' }))).toBe(
      'Already answered.',
    );
    expect(userMessage(new ApiError('conflict'))).toBe(API_ERROR_COPY.conflict);
  });

  it('falls back to the server copy for anything that is not an ApiError', () => {
    expect(userMessage(new Error('TypeError: x is undefined'))).toBe(API_ERROR_COPY.server);
  });

  it("shows an app-raised code's own words (sign-in not set up for this server)", () => {
    const notSetUp = new ApiError('auth', { code: APP_ERROR_CODES.signInNotSetUp });
    expect(userMessage(notSetUp)).toBe(APP_ERROR_COPY.signInNotSetUp);
    expect(APP_ERROR_COPY.signInNotSetUp).not.toMatch(/\d|https?:|\//);
  });

  it('a response cannot pick those words: a code read from a body keeps the kind copy', () => {
    const fromBody = errorFromResponse(
      401,
      JSON.stringify({ detail: { code: APP_ERROR_CODES.signInNotSetUp, message: 'x' } }),
    );
    expect(fromBody.code).toBe(APP_ERROR_CODES.signInNotSetUp);
    expect(userMessage(fromBody)).toBe(API_ERROR_COPY.auth);
    expect(userMessage(new ApiError('auth', { code: 'constructor' }))).toBe(API_ERROR_COPY.auth);
  });
});

describe("a limit's words", () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const limitIn = (seconds: number) =>
    new ApiError('limit', {
      status: 429,
      retryAfterSeconds: seconds,
      retryAt: now + seconds * 1000,
    });

  it('say later when it is not known when the limit lifts', () => {
    expect(userMessage(new ApiError('limit', { status: 429 }))).toBe(API_ERROR_COPY.limit);
    expect(API_ERROR_COPY.limit).toMatch(/limit/);
    expect(API_ERROR_COPY.limit).toMatch(/later/);
  });

  it('round up to whole minutes, and say under a minute for the last one', () => {
    expect(userMessage(limitIn(0))).toBe(LIMIT_COPY.underAMinute);
    expect(userMessage(limitIn(59))).toBe(LIMIT_COPY.underAMinute);
    expect(userMessage(limitIn(60))).toBe(LIMIT_COPY.underAMinute);
    expect(userMessage(limitIn(61))).toBe(LIMIT_COPY.inMinutes(2));
    expect(userMessage(limitIn(3600))).toBe(LIMIT_COPY.inMinutes(60));
    expect(LIMIT_COPY.inMinutes(3)).toBe(
      "You've reached a limit for now. Try again in about 3 minutes.",
    );
  });

  it("are worded against the caller's clock when it gives one", () => {
    const error = limitIn(600);
    expect(userMessage(error, now + 5 * 60_000)).toBe(LIMIT_COPY.inMinutes(5));
    expect(userMessage(error, now + 9 * 60_000 + 30_000)).toBe(LIMIT_COPY.underAMinute);
    expect(userMessage(error, now + 20 * 60_000)).toBe(LIMIT_COPY.underAMinute);
  });

  it('never show the server words, and never a wait past a day', () => {
    const own = new ApiError('limit', { serverMessage: 'Rate limit exceeded for x.' });
    expect(userMessage(own)).toBe(API_ERROR_COPY.limit);
    expect(userMessage(new ApiError('limit', { retryAfterSeconds: 86_401 }))).toBe(
      API_ERROR_COPY.limit,
    );
    expect(limitWords(null)).toBe(API_ERROR_COPY.limit);
  });
});
