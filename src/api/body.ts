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

/**
 * A body read whole as bytes, never more than `maxBytes`: a Content-Length over it is refused before
 * any byte is read, and a body that grows past it is cancelled at that read (BodyTooLargeError).
 */
export async function readBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  contentLength: string | null = null,
): Promise<Uint8Array> {
  if (Number(contentLength) > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  let parts: readonly Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return joined(parts, size);
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch((error: unknown) => logger.debug('[api] body cancel failed', error));
      throw new BodyTooLargeError(maxBytes);
    }
    parts = [...parts, value];
  }
}
