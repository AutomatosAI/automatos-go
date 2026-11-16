// Streaming bodies (PRD-001 §4.4): the response is read as it arrives, through the client's stream()
// (expo/fetch on device). streamTurn reads a chat turn, POST /api/chat answering the AI SDK v1 data
// stream, line by line with src/core/ai-sdk-stream.ts; sse.ts reads text/event-stream the same way.
// A non-OK status before the body is the client's ApiError; a read that fails after the status is a
// 'stream' error, and so is a stream ended by one of its limits (stream-limits.ts: silent too long,
// open too long, too much in all, or one line too long); the caller's abort cancels the read and
// resolves 'aborted' (the turn itself keeps running on the server: Stop is its own call,
// POST /api/chat/{id}/cancel).

import { parseLine, pushChunk, type Frame } from '../core/ai-sdk-stream';
import { logger } from '../lib/logger';
import type { ApiClient, StreamCallOptions } from './client';
import { CHAT_TURN_IDLE_TIMEOUT_MS, CHAT_TURN_MAX_MS } from './config';
import { ApiError, isAbortError, isApiError } from './errors';
import { checkLines } from './stream-limits';
import type { Route } from './routes';
import type { StreamingResponse } from './transport-types';

export type StreamOutcome = 'complete' | 'aborted';

const ABORTED = Symbol('aborted');
type Next = IteratorResult<string> | typeof ABORTED;

/** The client's stream(), or null when the caller aborted before the server answered. */
export async function openStream(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  call: StreamCallOptions,
): Promise<StreamingResponse | null> {
  try {
    return await client.stream(route, call);
  } catch (error) {
    if (call.signal?.aborted && isAbortError(error)) return null;
    throw error;
  }
}

/** The next chunk, or ABORTED as soon as the signal fires, even while a read is pending. */
function readNext(iterator: AsyncIterator<string>, signal?: AbortSignal): Promise<Next> {
  if (!signal) return iterator.next();
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise<Next>((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener('abort', onAbort);
    iterator
      .next()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function closeReader(iterator: AsyncIterator<string>): void {
  // the transport cancels the underlying read in its own cleanup; a failure to cancel changes nothing
  iterator.return?.()?.catch((error: unknown) => logger.debug('[api] stream close failed', error));
}

/** Feeds each decoded chunk to onChunk until the body ends or the caller aborts. */
export async function readChunks(
  response: StreamingResponse,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  const iterator = response.chunks()[Symbol.asyncIterator]();
  try {
    for (;;) {
      let next: Next;
      try {
        next = await readNext(iterator, signal);
      } catch (error) {
        if (signal?.aborted) return 'aborted';
        throw isApiError(error) ? error : new ApiError('stream', { cause: error });
      }
      if (next === ABORTED || signal?.aborted) return 'aborted';
      if (next.done) return 'complete';
      onChunk(next.value);
    }
  } finally {
    closeReader(iterator);
  }
}

/** A turn's call: its body and signal, with the connect and idle timeouts when given. */
function turnCall(
  body: unknown,
  signal: AbortSignal | undefined,
  connectTimeoutMs: number | undefined,
  idleTimeoutMs: number,
): StreamCallOptions {
  const connect = connectTimeoutMs === undefined ? {} : { connectTimeoutMs };
  return { body, signal, idleTimeoutMs, maxDurationMs: CHAT_TURN_MAX_MS, ...connect };
}

/**
 * One chat turn: every line of the body as a Frame, in order, including the last line when the body
 * ends without a newline. Unknown lines arrive as {kind: 'unknown'}; parseLine never throws. The
 * status must come within `connectTimeoutMs` (the client's own when not given); the body then runs
 * as long as it keeps coming, ended as 'stream' when silent for `idleTimeoutMs`, when open for
 * CHAT_TURN_MAX_MS, or when one line, whole or still held, is over STREAM_LINE_MAX_CHARS.
 */
export async function streamTurn(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  body: unknown,
  onFrame: (frame: Frame) => void,
  signal?: AbortSignal,
  connectTimeoutMs?: number,
  idleTimeoutMs = CHAT_TURN_IDLE_TIMEOUT_MS,
): Promise<StreamOutcome> {
  const call = turnCall(body, signal, connectTimeoutMs, idleTimeoutMs);
  const response = await openStream(client, route, call);
  if (!response) return 'aborted';
  let buffer = '';
  const outcome = await readChunks(
    response,
    (chunk) => {
      const { lines, rest } = pushChunk(buffer, chunk);
      checkLines([...lines, rest]);
      buffer = rest;
      lines.forEach((line) => onFrame(parseLine(line)));
    },
    signal,
  );
  if (outcome === 'complete' && buffer.trim() !== '') onFrame(parseLine(buffer));
  return outcome;
}
