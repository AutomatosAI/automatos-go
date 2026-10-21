// text/event-stream bodies (GET /api/v1/tasks/stream): read as they arrive through the client, with
// the bearer the stream needs (so fetch, not EventSource), and split into events by the web's own
// parseSSEFrames (vendored, hooks/use-board-event-stream.ts). Heartbeat comments are dropped there.
// Event data is passed on as the parser decoded it; each consumer parses it with zod (FND-5).

import { parseSSEFrames } from '../core/web/hooks/use-board-event-stream';
import type { ApiClient } from './client';
import type { Route } from './routes';
import { openStream, readChunks, type StreamOutcome } from './stream';

export type ServerEvent = ReturnType<typeof parseSSEFrames>['events'][number];

/** Every complete event of the stream, in order, until it ends or the caller aborts. */
export async function readEvents(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  onEvent: (event: ServerEvent) => void,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  const response = await openStream(client, route, { signal });
  if (!response) return 'aborted';
  let buffer = '';
  return readChunks(
    response,
    (chunk) => {
      const { events, rest } = parseSSEFrames(buffer + chunk);
      buffer = rest;
      events.forEach((event) => onEvent(event));
    },
    signal,
  );
}
