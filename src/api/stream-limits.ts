// What an opened stream may do (a chat turn, the live events): once the status has come, its body
// runs as long as the server keeps it going, but never silent for longer than its idle timeout,
// never open for longer than its total time on an absolute clock (a chunk resets the idle timer,
// never this one: one character a minute cannot hold a stream open without end), never more than
// STREAM_MAX_CHARS in all, and never one line or event (whole, or the part of one still held) over
// STREAM_LINE_MAX_CHARS (config.ts says what each number is based on). A stream
// past a limit is ended: its request is aborted, which fails the transport's pending read and
// cancels the body's reader (body.ts decodeChunks), and the reader of the chunks is told why with a
// StreamLimitError, which stream.ts reads as the kind 'stream' in that kind's own words.

import { logger } from '../lib/logger';
import { STREAM_LINE_MAX_CHARS, STREAM_MAX_CHARS } from './config';
import { ApiError } from './errors';

/** Epoch ms; injected in tests, the phone's clock otherwise. */
export type Clock = () => number;

export type StreamLimitKind = 'idle' | 'time' | 'total' | 'line';

/** A stream ended by one of its limits; the message names the limit, never a byte of the body. */
export class StreamLimitError extends Error {
  readonly limit: StreamLimitKind;

  constructor(limit: StreamLimitKind, detail: string) {
    super(`the stream was ended: ${detail}`);
    this.name = 'StreamLimitError';
    this.limit = limit;
  }
}

export type StreamLimits = {
  /** No chunk for this long ends the stream. */
  readonly idleMs: number;
  /** More characters than this in all ends it. */
  readonly maxChars: number;
  /** Open for longer than this in all, on the clock, ends it, however steadily it sends. */
  readonly maxMs: number;
};

/** The next chunk, or `limit` once `waitMs` has passed without one. */
function nextWithin(
  iterator: AsyncIterator<string>,
  waitMs: number,
  limit: () => StreamLimitError,
): Promise<IteratorResult<string>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(limit()), waitMs);
  });
  return Promise.race([iterator.next(), late]).finally(() => clearTimeout(timer));
}

/** The next chunk within the idle timeout and what is left of the total time, whichever is less. */
function nextInTime(
  iterator: AsyncIterator<string>,
  limits: StreamLimits,
  leftMs: number,
): Promise<IteratorResult<string>> {
  const overTime = () => new StreamLimitError('time', `open for over ${limits.maxMs} ms`);
  if (leftMs <= 0) return Promise.reject(overTime());
  if (leftMs < limits.idleMs) return nextWithin(iterator, leftMs, overTime);
  const idle = () => new StreamLimitError('idle', `nothing came for ${limits.idleMs} ms`);
  return nextWithin(iterator, limits.idleMs, idle);
}

function release(iterator: AsyncIterator<string>): void {
  // runs once a read still pending has settled (the abort fails it); a failure changes nothing
  iterator.return?.()?.catch((error: unknown) => logger.debug('[api] stream close failed', error));
}

/**
 * The chunks of `source` under `limits`. Past one, `end` is called (it aborts the request) and the
 * loop throws a StreamLimitError at once, without waiting on a read the server may never answer.
 */
export async function* limitedChunks(
  source: AsyncIterable<string>,
  limits: StreamLimits,
  end: () => void,
  clock: Clock = Date.now,
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();
  const endsAt = clock() + limits.maxMs;
  let total = 0;
  try {
    for (;;) {
      const next = await nextInTime(iterator, limits, endsAt - clock());
      if (next.done) return;
      total += next.value.length;
      if (total > limits.maxChars) {
        throw new StreamLimitError('total', `over ${limits.maxChars} characters in all`);
      }
      yield next.value;
    }
  } catch (error) {
    if (error instanceof StreamLimitError) end();
    throw error;
  } finally {
    release(iterator);
  }
}

/** A stream's limits: its idle timeout and total time, and the one total of characters. */
export function streamLimits(idleMs: number, maxMs: number): StreamLimits {
  return Object.freeze({ idleMs, maxMs, maxChars: STREAM_MAX_CHARS });
}

/**
 * Ends a stream whose line or event (whole, or the part of one still held) is over the cap: a
 * 'stream' ApiError, thrown from the reader's own loop so that the body is cancelled behind it.
 */
export function checkLines(pieces: readonly string[], maxChars = STREAM_LINE_MAX_CHARS): void {
  if (pieces.some((piece) => piece.length > maxChars)) throw lineTooLong(maxChars);
}

/** What a line or event over its cap ends the stream with: the kind 'stream'. */
export function lineTooLong(maxChars: number): ApiError {
  const cause = new StreamLimitError('line', `a line over ${maxChars} characters`);
  return new ApiError('stream', { cause });
}
