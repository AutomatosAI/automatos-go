// A response body as text, decoded as it arrives (the transport's chunks()). A character whose bytes
// are split across reads is held back by the streaming decoder until the rest arrives. Leaving the
// loop early cancels the read, so an aborted turn stops pulling bytes off the socket. readBytes is
// the transport's bytes(): a whole body as bytes under a cap, so a server cannot fill the phone's
// memory before the caller's size check (the server voice's MP3s).

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

/**
 * A body read whole as bytes, never more than `maxBytes`: a Content-Length over it is refused before
 * any byte is read, and its body cancelled so that nothing more of it is taken in; a body that
 * grows past the cap is cancelled at that read (BodyTooLargeError). A
 * run of empty reads is cancelled too (BodyStalledError): they never reach the cap. The parts are
 * gathered in one local list, appended to in place: a copy at every read would make a body sent a
 * byte at a time cost the square of its size.
 */
export async function readBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null = null,
): Promise<Uint8Array> {
  refuseByLength(body, maxBytes, contentLength);
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const cancel = () => reader.cancel().catch(logCancelFailure);
  const parts: Uint8Array[] = [];
  let size = 0;
  let emptyReads = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return joined(parts, size);
    emptyReads = value.byteLength === 0 ? emptyReads + 1 : 0;
    if (emptyReads >= MAX_EMPTY_READS) {
      cancel();
      throw new BodyStalledError();
    }
    size += value.byteLength;
    if (size > maxBytes) {
      cancel();
      throw new BodyTooLargeError(maxBytes);
    }
    if (value.byteLength > 0) parts.push(value);
  }
}
