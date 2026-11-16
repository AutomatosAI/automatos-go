// text/event-stream bodies (GET /api/v1/tasks/stream): read as they arrive through the client, with
// the bearer the stream needs (so fetch, not EventSource), and split into events by the web's own
// parseSSEFrames (vendored, hooks/use-board-event-stream.ts). Heartbeat comments are dropped there.
// Event data is passed on as the parser decoded it; each consumer parses it with zod (FND-5). The
// stream is ended as 'stream' by its limits (stream-limits.ts): silent past the client's idle
// timeout, open past its total time, too much in all, or one event, whole or still held, over
// STREAM_LINE_MAX_CHARS, which is checked before the parser reads it. A part of an event still
// coming is held (held-text.ts), never parsed again at every chunk.

import { parseSSEFrames } from '../core/web/hooks/use-board-event-stream';
import type { ApiClient } from './client';
import type { Route } from './routes';
import { openStream, readChunks, type StreamOutcome } from './stream';
import { heldText } from './held-text';
import { checkLines } from './stream-limits';

const EVENT_SEPARATOR = '\n\n';

export type ServerEvent = ReturnType<typeof parseSSEFrames>['events'][number];

/**
 * The stream's events, a chunk at a time: an event still coming is held (held-text.ts) and parsed
 * only when a chunk may end one, so a long event in small chunks costs its length once.
 */
export function eventChunks(onEvent: (event: ServerEvent) => void): (chunk: string) => void {
  const held = heldText(EVENT_SEPARATOR);
  return (chunk) => {
    const text = held.take(chunk);
    if (text === null) return; // no event ends in it: held, its length counted
    checkLines(text.split(EVENT_SEPARATOR));
    const { events, rest } = parseSSEFrames(text);
    held.keep(rest);
    events.forEach((event) => onEvent(event));
  };
}

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
  return readChunks(response, eventChunks(onEvent), signal);
}
