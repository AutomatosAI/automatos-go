// A response body as text, decoded as it arrives (the transport's chunks()). A character whose bytes
// are split across reads is held back by the streaming decoder until the rest arrives. Leaving the
// loop early cancels the read, so an aborted turn stops pulling bytes off the socket.

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
