import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client';
import { ApiError } from '../errors';
import { routes } from '../routes';
import { readEvents, type ServerEvent } from '../sse';
import { SERVER, chunked, fakeTransport, flush, jsonReply, PENDING } from './fake-transport';

// Frames as orchestrator/services/board_events.py writes them: `event: <name>\ndata: <json>\n\n`,
// and a `: hb\n\n` heartbeat comment every BOARD_SSE_HEARTBEAT_SECONDS.
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function clientOver(response: ReturnType<typeof chunked> | ReturnType<typeof jsonReply>) {
  const transport = fakeTransport(() => response);
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
  return { client, transport };
}

describe('readEvents', () => {
  it('reads GET /api/v1/tasks/stream with the bearer', async () => {
    const { client, transport } = clientOver(chunked([frame('board_changed', {})]));
    await readEvents(client, routes.tasksStream, () => undefined);
    expect(transport.calls[0]).toMatchObject({
      url: 'https://api.example.test/api/v1/tasks/stream',
      method: 'GET',
      headers: { Authorization: 'Bearer jwt.token.value', 'X-Workspace-ID': 'ws-1' },
    });
  });

  it('joins events cut across chunks and drops heartbeats', async () => {
    const boardChanged = frame('board_changed', {
      workspace_id: 'ws-1',
      task_id: 7,
      status: 'done',
    });
    const chatChanged = frame('chat_changed', { workspace_id: 'ws-1', chat_id: 'c-1' });
    const { client } = clientOver(
      chunked([boardChanged.slice(0, 20), boardChanged.slice(20) + ': hb\n\n', chatChanged]),
    );
    const events: ServerEvent[] = [];
    const outcome = await readEvents(client, routes.tasksStream, (event) => events.push(event));
    expect(outcome).toBe('complete');
    expect(events).toEqual([
      { event: 'board_changed', data: { workspace_id: 'ws-1', task_id: 7, status: 'done' } },
      { event: 'chat_changed', data: { workspace_id: 'ws-1', chat_id: 'c-1' } },
    ]);
  });

  it('maps a non-OK status through the taxonomy', async () => {
    const { client } = clientOver(jsonReply(401, { detail: 'Not authenticated' }));
    const error = await readEvents(client, routes.tasksStream, () => undefined).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('auth');
  });

  it('stops on abort while waiting for the next event', async () => {
    const controller = new AbortController();
    const { client } = clientOver(chunked([frame('board_changed', {}), PENDING]));
    const events: ServerEvent[] = [];
    const done = readEvents(
      client,
      routes.tasksStream,
      (event) => events.push(event),
      controller.signal,
    );
    await flush();
    controller.abort();
    expect(await done).toBe('aborted');
    expect(events).toHaveLength(1);
  });
});
