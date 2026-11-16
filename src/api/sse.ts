// text/event-stream bodies (GET /api/v1/tasks/stream): read as they arrive through the client, with
// the bearer the stream needs (so fetch, not EventSource), and split into events by the web's own
// parseSSEFrames (vendored, hooks/use-board-event-stream.ts). Heartbeat comments are dropped there.
// Event data is passed on as the parser decoded it; each consumer parses it with zod (FND-5). The
// stream is ended as 'stream' by its limits (stream-limits.ts): silent past the client's idle
// timeout, too much in all, or one event, whole or still held, over STREAM_LINE_MAX_CHARS, which
// is checked before the parser reads it.

import { parseSSEFrames } from '../core/web/hooks/use-board-event-stream';
import type { ApiClient } from './client';
import type { Route } from './routes';
import { openStream, readChunks, type StreamOutcome } from './stream';
import { checkLines } from './stream-limits';

const EVENT_SEPARATOR = '\n\n';

export type ServerEvent = ReturnType<typeof parseSSEFrames>['events'][number];

/**
 * Every complete event of the stream, in order, until it ends or the caller aborts. onOpen runs
 * once the server has answered OK, before the first event (the live status, the backoff reset).
 */
export async function readEvents(
  client: Pick<ApiClient, 'stream'>,
  route: Route,
  onEvent: (event: ServerEvent) => void,
  signal?: AbortSignal,
  onOpen?: () => void,
): Promise<StreamOutcome> {
  const response = await openStream(client, route, { signal });
  if (!response) return 'aborted';
  onOpen?.();
  let buffer = '';
  return readChunks(
    response,
    (chunk) => {
      const text = buffer + chunk;
      checkLines(text.split(EVENT_SEPARATOR));
      const { events, rest } = parseSSEFrames(text);
      buffer = rest;
      events.forEach((event) => onEvent(event));
    },
    signal,
  );
}
