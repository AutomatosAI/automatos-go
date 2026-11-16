// A response body as text, decoded as it arrives (the transport's chunks()). A character whose bytes
// are split across reads is held back by the streaming decoder until the rest arrives. Leaving the
// loop early cancels the read, so an aborted turn stops pulling bytes off the socket. readBytes is
// the transport's bytes(): a whole body as bytes under a cap, so a server cannot fill the phone's
// memory before the caller's size check (the server voice's MP3s). readParts is a file's parts():
// the bytes as they arrive, counted against a cap, for transfer.ts to write to a file.

import { logger } from '../lib/logger';

export async function* decodeChunks(
  body: ReadableStream<Uint8Array> | null,
  decoder: TextDecoder = new TextDecoder(),
): AsyncGenerator<string> {
  if (!body) return;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  } finally {
    // after the end this is a no-op; after an abort the read is already failing
    reader.cancel().catch((error: unknown) => logger.debug('[api] body cancel failed', error));
  }
}

/** A body over the caller's cap: the read was cancelled as soon as it crossed it. */
export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`the body is over ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

function joined(parts: readonly Uint8Array[], size: number): Uint8Array {
  const whole = new Uint8Array(size);
  parts.reduce((offset, part) => {
    whole.set(part, offset);
    return offset + part.byteLength;
  }, 0);
  return whole;
}

/** A body that keeps answering with nothing: more empty reads in a row than any real one sends. */
export const MAX_EMPTY_READS = 1_000;

/** A body that sent MAX_EMPTY_READS empty reads in a row: cancelled, as a server that stalls. */
export class BodyStalledError extends Error {
  constructor() {
    super(`the body sent ${MAX_EMPTY_READS} empty reads in a row`);
    this.name = 'BodyStalledError';
  }
}

const logCancelFailure = (error: unknown) => logger.debug('[api] body cancel failed', error);

/**
 * A Content-Length over the cap: refused unread. The body is cancelled too, or the bytes still on
 * their way would pile up behind it.
 */
function refuseByLength(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null,
): void {
  if (!(Number(contentLength) > maxBytes)) return;
  body?.cancel().catch(logCancelFailure);
  throw new BodyTooLargeError(maxBytes);
}

/** The reads gathered into one body; over the cap or stalled, a throw (the caller cancels). */
async function gather(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let size = 0;
  let emptyReads = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return joined(parts, size);
    emptyReads = value.byteLength === 0 ? emptyReads + 1 : 0;
    if (emptyReads >= MAX_EMPTY_READS) throw new BodyStalledError();
    size += value.byteLength;
    if (size > maxBytes) throw new BodyTooLargeError(maxBytes);
    if (value.byteLength > 0) parts.push(value);
  }
}

/**
 * A body read whole as bytes, never more than `maxBytes`: a Content-Length over it is refused before
 * any byte is read, and its body cancelled so that nothing more of it is taken in; a body that
 * grows past the cap is cancelled at that read (BodyTooLargeError). A run of empty reads is
 * cancelled too (BodyStalledError): they never reach the cap. A read that fails cancels the body as
 * well, and the reader's lock is released however the read ends. The parts are gathered in one
 * local list, appended to in place: a copy at every read would make a body sent a byte at a time
 * cost the square of its size.
 */
export async function readBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null = null,
): Promise<Uint8Array> {
  refuseByLength(body, maxBytes, contentLength);
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  try {
    return await gather(reader, maxBytes);
  } catch (error) {
    reader.cancel().catch(logCancelFailure);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** A body that ended short of, or ran past, the exact length its answer declared. */
export class BodyLengthError extends Error {
  constructor(declared: number, received: number) {
    super(`the body was ${received} bytes, not the ${declared} its answer declared`);
    this.name = 'BodyLengthError';
  }
}

/** A Content-Length as a whole number of bytes; null when there is none or it is not one. */
function declaredLength(contentLength: string | null): number | null {
  const text = contentLength?.trim() ?? '';
  return /^\d{1,15}$/.test(text) ? Number(text) : null;
}

/** Past the exact length, or (at the end) short of it: refused. Nothing when there is none. */
function checkLength(exact: number | null, size: number, ended: boolean): void {
  if (exact === null) return;
  if (size > exact || (ended && size !== exact)) throw new BodyLengthError(exact, size);
}

/**
 * The reads of `reader`, empty ones skipped, refused past the cap or a run of empty reads, and,
 * when `exact` is a length, refused at the read that runs past it or at an end short of it.
 */
async function* counted(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
  exact: number | null,
): AsyncGenerator<Uint8Array> {
  let size = 0;
  let emptyReads = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    emptyReads = value.byteLength === 0 ? emptyReads + 1 : 0;
    if (emptyReads >= MAX_EMPTY_READS) throw new BodyStalledError();
    size += value.byteLength;
    if (size > maxBytes) throw new BodyTooLargeError(maxBytes);
    checkLength(exact, size, false);
    if (value.byteLength > 0) yield value;
  }
  checkLength(exact, size, true);
}

/**
 * A body as its bytes as they arrive, never more than `maxBytes` in all: a Content-Length over it
 * is refused before any byte is read, a body that grows past it is cancelled at that read, and so
 * is a run of empty reads. When `lengthIsExact` (the body is not content-encoded, so its
 * Content-Length counts the bytes read), a body that ends short of that length or runs past it is
 * refused too (BodyLengthError): a body cut off with no error of its own is never kept as whole.
 * Leaving the loop early, or a read that fails, cancels the body too; the reader's lock is released
 * however it ends. Nothing is kept: each part is handed on as it comes.
 */
export async function* readParts(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null = null,
  lengthIsExact = false,
): AsyncGenerator<Uint8Array> {
  refuseByLength(body, maxBytes, contentLength);
  const exact = lengthIsExact ? declaredLength(contentLength) : null;
  if (!body) {
    if (exact) throw new BodyLengthError(exact, 0);
    return;
  }
  const reader = body.getReader();
  let finished = false;
  try {
    yield* counted(reader, maxBytes, exact);
    finished = true;
  } finally {
    // after the end this is not needed; after a refusal, a failure or an early exit it stops the body
    if (!finished) reader.cancel().catch(logCancelFailure);
    reader.releaseLock();
  }
}
