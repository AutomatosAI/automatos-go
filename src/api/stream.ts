// Streaming bodies (PRD-001 §4.4): the response is read as it arrives, through the client's stream()
// (expo/fetch on device). streamTurn reads a chat turn, POST /api/chat answering the AI SDK v1 data
// stream, line by line with src/core/ai-sdk-stream.ts; sse.ts reads text/event-stream the same way.
// A non-OK status before the body is the client's ApiError; a read that fails after the status is a
// 'stream' error; the caller's abort cancels the read and resolves 'aborted' (the turn itself keeps
// running on the server: Stop is its own call, POST /api/chat/{id}/cancel).

import { parseLine, pushChunk, type Frame } from '../core/ai-sdk-stream';
import { logger } from '../lib/logger';
import type { ApiClient, CallOptions } from './client';
import { ApiError, isAbortError } from './errors';
import type { Route } from './routes';
import type { StreamingResponse } from './transport-types';

export type StreamOutcome = 'complete' | 'aborted';

const ABORTED = Symbol('aborted');
type Next = IteratorResult<string> | typeof ABORTED;

/** The client's stream(), or null when the caller aborted before the server answered. */
export async function openStream(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  call: CallOptions,
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
        throw new ApiError('stream', { cause: error });
      }
      if (next === ABORTED || signal?.aborted) return 'aborted';
      if (next.done) return 'complete';
      onChunk(next.value);
    }
  } finally {
    closeReader(iterator);
  }
}

/**
 * One chat turn: every line of the body as a Frame, in order, including the last line when the body
 * ends without a newline. Unknown lines arrive as {kind: 'unknown'}; parseLine never throws.
 */
export async function streamTurn(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  body: unknown,
  onFrame: (frame: Frame) => void,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  const response = await openStream(client, route, { body, signal });
  if (!response) return 'aborted';
  let buffer = '';
  const outcome = await readChunks(
    response,
    (chunk) => {
      const { lines, rest } = pushChunk(buffer, chunk);
      buffer = rest;
      lines.forEach((line) => onFrame(parseLine(line)));
    },
    signal,
  );
  if (outcome === 'complete' && buffer.trim() !== '') onFrame(parseLine(buffer));
  return outcome;
}
