// An opened stream's limits (private finding H6): silent past its idle timeout, more than its total
// in all, or one line or event over its cap, and the stream is ended as the kind 'stream': the
// request is aborted and the body's reader cancelled.

import { describe, expect, it, vi } from 'vitest';

import type { Frame } from '../../core/ai-sdk-stream';
import { decodeChunks } from '../body';
import { createApiClient } from '../client';
import { CHAT_TURN_MAX_MS, STREAM_LINE_MAX_CHARS } from '../config';
import { ApiError, userMessage } from '../errors';
import type { Route } from '../routes';
import { readEvents } from '../sse';
import { streamTurn } from '../stream';
import { StreamLimitError, checkLines, limitedChunks } from '../stream-limits';
import { API_ERROR_COPY } from '../strings';
import type { StreamingResponse, TransportRequest } from '../transport-types';
import { SERVER, fakeTransport, type FakeTransport } from './fake-transport';

const CHAT: Route = { method: 'POST', path: '/api/chat' };
const EVENTS: Route = { method: 'GET', path: '/api/v1/tasks/stream' };
const BODY = { message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] } };
const OVER = 'x'.repeat(STREAM_LINE_MAX_CHARS + 1);

function clientWith(transport: FakeTransport, streamIdleTimeoutMs?: number) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => 'ws-1',
    transport,
    ...(streamIdleTimeoutMs === undefined ? {} : { streamIdleTimeoutMs }),
  });
}

type Watched = { response: StreamingResponse; cancelled: () => boolean };

/**
 * A real byte stream that sends `parts`, then waits for more that never come; a read pending when
 * the request aborts fails, as fetch's does. `cancelled` says whether its reader was cancelled.
 */
function bodyOf(request: TransportRequest, parts: readonly string[]): Watched {
  const encoder = new TextEncoder();
  let next = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      const part = parts[next];
      next += 1;
      if (part !== undefined) return controller.enqueue(encoder.encode(part));
      return new Promise<void>((_, reject) => {
        const fail = () => reject(new Error('Aborted'));
        if (request.signal.aborted) fail();
        else request.signal.addEventListener('abort', fail, { once: true });
      });
    },
    cancel: () => {
      cancelled = true;
    },
  });
  const response: StreamingResponse = {
    status: 200,
    header: () => null,
    bytes: async () => new Uint8Array(0),
    chunks: () => decodeChunks(body),
  };
  return { response, cancelled: () => cancelled };
}

function watching(parts: readonly string[]) {
  const seen: { body: Watched | null } = { body: null };
  const transport = fakeTransport((request) => {
    seen.body = bodyOf(request, parts);
    return seen.body.response;
  });
  return { transport, cancelled: () => seen.body?.cancelled() ?? false };
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

describe('a chat turn under its limits', () => {
  it('a line over its cap ends the stream, in the stream words, and cancels the reader', async () => {
    const { transport, cancelled } = watching(['0:"ok"\n', `0:"${OVER.slice(0, 10)}`, OVER]);
    const frames: Frame[] = [];
    const error = await failureOf(
      streamTurn(clientWith(transport), CHAT, BODY, (frame) => frames.push(frame)),
    );
    expect(error.kind).toBe('stream');
    expect(error.cause).toBeInstanceOf(StreamLimitError);
    expect(userMessage(error)).toBe(API_ERROR_COPY.stream);
    expect(frames).toEqual([{ kind: 'text', text: 'ok' }]);
    await vi.waitFor(() => expect(cancelled()).toBe(true));
  });

  it('a whole line over its cap in one chunk ends it too', async () => {
    const { transport } = watching([`0:"${OVER}"\n`]);
    const error = await failureOf(streamTurn(clientWith(transport), CHAT, BODY, () => undefined));
    expect(error.kind).toBe('stream');
  });

  it('the idle timeout ends the stream and aborts its request', async () => {
    const { transport } = watching(['0:"one"\n']);
    const frames: Frame[] = [];
    const turn = streamTurn(
      clientWith(transport),
      CHAT,
      BODY,
      (frame) => frames.push(frame),
      undefined,
      undefined,
      20,
    );
    const error = await failureOf(turn);
    expect(error.kind).toBe('stream');
    expect(error.cause).toMatchObject({ name: 'StreamLimitError', limit: 'idle' });
    expect(frames).toEqual([{ kind: 'text', text: 'one' }]);
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it('a stream that keeps sending inside its idle timeout runs on', async () => {
    const transport = fakeTransport(() => ({
      status: 200,
      header: () => null,
      bytes: async () => new Uint8Array(0),
      chunks: async function* () {
        for (const word of ['0:"a"\n', '0:"b"\n', '0:"c"\n']) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          yield word;
        }
      },
    }));
    const frames: Frame[] = [];
    const outcome = await streamTurn(
      clientWith(transport),
      CHAT,
      BODY,
      (frame) => frames.push(frame),
      undefined,
      undefined,
      40,
    );
    expect(outcome).toBe('complete');
    expect(frames).toHaveLength(3);
  });
});

describe('a stream past its total time', () => {
  it('a chat turn is opened with the turn total, CHAT_TURN_MAX_MS', async () => {
    const stream = vi.fn(async () => ({
      status: 200,
      header: () => null,
      bytes: async () => new Uint8Array(0),
      chunks: async function* () {
        yield '0:"ok"\n';
      },
    }));
    await streamTurn({ stream }, CHAT, BODY, () => undefined);
    expect(stream).toHaveBeenCalledWith(
      CHAT,
      expect.objectContaining({ maxDurationMs: CHAT_TURN_MAX_MS }),
    );
  });

  it("the live events end at the client's total, as 'stream', and the request is aborted", async () => {
    const transport = fakeTransport((request) => ({
      status: 200,
      header: () => null,
      bytes: async () => new Uint8Array(0),
      chunks: async function* () {
        while (!request.signal.aborted) {
          yield ': hb\n\n';
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      },
    }));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'jwt.token.value',
      getWorkspaceId: () => 'ws-1',
      transport,
      streamMaxDurationMs: 30,
    });
    const error = await failureOf(readEvents(client, EVENTS, () => undefined));
    expect(error.kind).toBe('stream');
    expect(error.cause).toMatchObject({ limit: 'time' });
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });
});

describe('the live events under their limits', () => {
  it("the client's idle timeout ends the stream", async () => {
    const { transport } = watching(['event: board_changed\ndata: {}\n\n']);
    const events: unknown[] = [];
    const error = await failureOf(
      readEvents(clientWith(transport, 20), EVENTS, (event) => events.push(event)),
    );
    expect(error.kind).toBe('stream');
    expect(events).toHaveLength(1);
    expect(transport.calls[0]?.signal.aborted).toBe(true);
  });

  it('an event over its cap, still held, ends the stream before it is parsed', async () => {
    const { transport, cancelled } = watching(['event: board_changed\ndata: ', OVER]);
    const error = await failureOf(readEvents(clientWith(transport), EVENTS, () => undefined));
    expect(error.kind).toBe('stream');
    await vi.waitFor(() => expect(cancelled()).toBe(true));
  });
});

describe('limitedChunks', () => {
  async function* of(chunks: readonly string[]) {
    yield* chunks;
  }

  it('passes the chunks through untouched within its limits', async () => {
    const seen: string[] = [];
    for await (const chunk of limitedChunks(
      of(['ab', 'cd']),
      { idleMs: 50, maxChars: 4, maxMs: 60_000 },
      vi.fn(),
    ))
      seen.push(chunk);
    expect(seen).toEqual(['ab', 'cd']);
  });

  it('ends a stream over its total, and calls end so the request is aborted', async () => {
    const end = vi.fn();
    const seen: string[] = [];
    const error = await (async () => {
      for await (const chunk of limitedChunks(
        of(['ab', 'cd', 'e']),
        { idleMs: 50, maxChars: 4, maxMs: 60_000 },
        end,
      ))
        seen.push(chunk);
    })().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: 'StreamLimitError', limit: 'total' });
    expect(seen).toEqual(['ab', 'cd']);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('ends a stream open past its total time, however steadily it sends, on the clock', async () => {
    const end = vi.fn();
    let now = 0;
    async function* steady() {
      for (;;) {
        now += 10; // a character every 10 ms of the clock: never idle
        yield 'x';
      }
    }
    const seen: string[] = [];
    const error = await (async () => {
      for await (const chunk of limitedChunks(
        steady(),
        { idleMs: 50, maxChars: 1_000, maxMs: 35 },
        end,
        () => now,
      ))
        seen.push(chunk);
    })().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ name: 'StreamLimitError', limit: 'time' });
    expect(seen).toHaveLength(4); // the fourth was asked for at 30 ms, inside the 35
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('ends a stream whose next chunk would come after its total time, without waiting for it', async () => {
    const end = vi.fn();
    const never = {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => undefined) }),
    };
    const reading = limitedChunks(never, { idleMs: 1_000, maxChars: 4, maxMs: 10 }, end).next();
    await expect(reading).rejects.toMatchObject({ limit: 'time' });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('ends a silent stream at once, without waiting on the read', async () => {
    const end = vi.fn();
    const never = {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => undefined) }),
    };
    const reading = limitedChunks(never, { idleMs: 10, maxChars: 4, maxMs: 60_000 }, end).next();
    await expect(reading).rejects.toMatchObject({ limit: 'idle' });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('passes a failing read on as it is, without ending the request itself', async () => {
    const end = vi.fn();
    async function* broken(): AsyncGenerator<string> {
      yield 'a';
      throw new Error('connection reset');
    }
    const iterator = limitedChunks(broken(), { idleMs: 50, maxChars: 10, maxMs: 60_000 }, end);
    await iterator.next();
    await expect(iterator.next()).rejects.toThrow('connection reset');
    expect(end).not.toHaveBeenCalled();
  });
});

describe('checkLines', () => {
  it('lets a line at its cap through and ends one over it as stream', () => {
    expect(() => checkLines(['abc', 'abcd'], 4)).not.toThrow();
    const error = (() => {
      try {
        checkLines(['abcde'], 4);
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toMatchObject({ kind: 'stream' });
    expect(String((error as Error).cause)).not.toContain('abcde');
  });
});
