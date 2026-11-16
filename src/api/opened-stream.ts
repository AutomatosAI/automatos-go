// A stream the client has opened (client.ts stream()), once its status is OK: read as it arrives,
// under its limits (stream-limits.ts), or read whole under the deadline it was opened with. Either
// way the caller's abort listener is released once the body is finished with.

import { timedOutError, type Deadline } from './deadline';
import { limitedChunks, type StreamLimits } from './stream-limits';
import type { StreamingResponse } from './transport-types';

async function* chunksThen(
  chunks: AsyncIterable<string>,
  done: () => void,
): AsyncGenerator<string> {
  try {
    yield* chunks;
  } finally {
    done();
  }
}

/** How a stream was opened: its deadline, the connect timeout it ran under, its limits. */
export type Opening = {
  readonly deadline: Deadline;
  readonly ms: number;
  readonly limits: StreamLimits;
};

/**
 * The opened stream. Read as it arrives, the connect deadline stops and the body runs as long as
 * the server keeps it going, under the stream's limits. Read whole (bytes()), the deadline keeps
 * running until the body is in, so a body that drips cannot hold the call open without end.
 */
export function opened(
  response: StreamingResponse,
  { deadline, ms, limits }: Opening,
): StreamingResponse {
  return {
    status: response.status,
    bytes: async (maxBytes) => {
      try {
        return await response.bytes(maxBytes);
      } catch (error) {
        throw deadline.timedOut() ? timedOutError(ms) : error;
      } finally {
        deadline.dispose();
      }
    },
    header: (name) => response.header(name),
    chunks: () => {
      deadline.settle(); // the body may now run as long as it needs, within its limits
      const chunks = limitedChunks(response.chunks(), limits, deadline.expire);
      return chunksThen(chunks, deadline.dispose);
    },
  };
}
