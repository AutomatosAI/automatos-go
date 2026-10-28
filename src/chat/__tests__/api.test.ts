import { describe, expect, it } from 'vitest';

import {
  PENDING,
  SERVER,
  chunked,
  fakeTransport,
  jsonReply,
  reply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import { createApiClient, type ApiClient, type StreamCallOptions } from '../../api/client';
import { CHAT_TURN_CONNECT_TIMEOUT_MS, STREAM_CONNECT_TIMEOUT_MS } from '../../api/config';
import { ApiError } from '../../api/errors';
import type { StreamingResponse, TransportRequest } from '../../api/transport-types';
import type { Frame } from '../../core/ai-sdk-stream';
import {
  HISTORY_PAGE_SIZE,
  cancelTurn,
  fetchAgents,
  fetchChat,
  fetchHistory,
  fetchMessages,
  sendTurn,
} from '../api';
import { buildChatRequest } from '../request';

const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c001';
const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
const API = 'https://api.example.test';
const AT = '2026-10-21T08:30:00Z';

function clientWith(transport: FakeTransport) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
  });
}

function answering(value: unknown) {
  const transport = fakeTransport(() => jsonReply(200, value));
  return { transport, client: clientWith(transport) };
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

const firstCall = (transport: FakeTransport): TransportRequest => {
  const call = transport.calls[0];
  if (!call) throw new Error('nothing was sent');
  return call;
};

describe('sendTurn', () => {
  it('gives the turn’s status 120 s (the server picks who answers first), not the 30 s default', async () => {
    const calls: StreamCallOptions[] = [];
    const client: Pick<ApiClient, 'stream'> = {
      stream: async (_route, call = {}) => {
        calls.push(call);
        return chunked(['0:"ok"\n']);
      },
    };
    await sendTurn(client, buildChatRequest({ text: 'hi' }), () => undefined);
    expect(CHAT_TURN_CONNECT_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
    expect(STREAM_CONNECT_TIMEOUT_MS).toBeLessThan(CHAT_TURN_CONNECT_TIMEOUT_MS);
    expect(calls[0]?.connectTimeoutMs).toBe(CHAT_TURN_CONNECT_TIMEOUT_MS);
  });

  const BODY = buildChatRequest({ chatId: CHAT_ID, text: 'What needs me?' });

  it('posts the ChatRequest to /api/chat and feeds every frame in order', async () => {
    const response = chunked([
      'd:{"type":"chat-id","chatId":"' + CHAT_ID + '","ai_generated":true}\n0:"Two ',
      'things"\nd:{"type":"tool-start","data":{"toolCallId":"t1","toolName":"board_list"}}\n',
      'd:{"type":"brand-new","data":{}}\n',
      'd:{"type":"finish","finishReason":"stop","ai_generated":true}\n',
    ]);
    const transport = fakeTransport(() => response);
    const frames: Frame[] = [];
    const outcome = await sendTurn(clientWith(transport), BODY, (frame) => frames.push(frame));
    expect(outcome).toBe('complete');
    expect(firstCall(transport)).toMatchObject({
      url: `${API}/api/chat`,
      method: 'POST',
      body: JSON.stringify(BODY),
      headers: { Authorization: 'Bearer jwt.token.value', 'X-Workspace-ID': WORKSPACE_ID },
    });
    expect(frames).toEqual([
      { kind: 'chat-id', chatId: CHAT_ID, aiGenerated: true },
      { kind: 'text', text: 'Two things' },
      { kind: 'tool-start', toolCallId: 't1', toolName: 'board_list' },
      { kind: 'unknown' },
      { kind: 'finish', finishReason: 'stop', aiGenerated: true },
    ]);
  });

  it('stops reading when the caller aborts and resolves aborted', async () => {
    const response = chunked(['0:"Working"\n', PENDING]);
    const controller = new AbortController();
    const frames: Frame[] = [];
    const turn = sendTurn(
      clientWith(fakeTransport(() => response)),
      BODY,
      (frame) => {
        frames.push(frame);
        controller.abort();
      },
      controller.signal,
    );
    await expect(turn).resolves.toBe('aborted');
    expect(frames).toEqual([{ kind: 'text', text: 'Working' }]);
    expect(response.finished()).toBe(false);
  });

  it('throws the taxonomy error when the server refuses the turn before the body', async () => {
    const transport = fakeTransport((): StreamingResponse =>
      reply(403, JSON.stringify({ detail: 'Access denied' })),
    );
    const error = await failureOf(sendTurn(clientWith(transport), BODY, () => undefined));
    expect(error).toMatchObject({ kind: 'forbidden', status: 403 });
  });
});

describe('cancelTurn', () => {
  it("posts to the chat's cancel route and reads {cancelled}", async () => {
    const { transport, client } = answering({ cancelled: true });
    await expect(cancelTurn(client, CHAT_ID)).resolves.toEqual({ cancelled: true });
    expect(firstCall(transport)).toMatchObject({
      url: `${API}/api/chat/${CHAT_ID}/cancel`,
      method: 'POST',
    });
    expect(firstCall(transport)).not.toHaveProperty('body');
  });
});

describe('fetchChat', () => {
  it('reads one chat with turnInFlight', async () => {
    const { transport, client } = answering({ id: CHAT_ID, title: 'Launch', turnInFlight: true });
    await expect(fetchChat(client, CHAT_ID)).resolves.toMatchObject({
      id: CHAT_ID,
      turnInFlight: true,
    });
    expect(firstCall(transport)).toMatchObject({
      url: `${API}/api/chat/${CHAT_ID}`,
      method: 'GET',
    });
  });

  it('is not_found for a stale id and forbidden for another user’s chat', async () => {
    const gone = clientWith(fakeTransport(() => jsonReply(404, { detail: 'Chat not found' })));
    const theirs = clientWith(fakeTransport(() => jsonReply(403, { detail: 'Access denied' })));
    expect((await failureOf(fetchChat(gone, CHAT_ID))).kind).toBe('not_found');
    expect((await failureOf(fetchChat(theirs, CHAT_ID))).kind).toBe('forbidden');
  });
});

describe('fetchMessages', () => {
  it("reads the chat's saved messages", async () => {
    const { transport, client } = answering([
      { id: 'm-1', role: 'user', parts: [{ type: 'text', text: 'hi' }], createdAt: AT },
    ]);
    const messages = await fetchMessages(client, CHAT_ID);
    expect(messages).toEqual([
      {
        id: 'm-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hi' }],
        attachments: [],
        source: null,
        createdAt: AT,
      },
    ]);
    expect(firstCall(transport).url).toBe(`${API}/api/chat/${CHAT_ID}/messages`);
  });

  it('is invalid_response when the body is not a list', async () => {
    const { client } = answering({ detail: 'odd' });
    expect((await failureOf(fetchMessages(client, CHAT_ID))).kind).toBe('invalid_response');
  });
});

describe('fetchHistory', () => {
  it('asks for the newest 50 by default, with no cursor', async () => {
    const { transport, client } = answering([]);
    await expect(fetchHistory(client)).resolves.toEqual([]);
    expect(HISTORY_PAGE_SIZE).toBe(50);
    expect(firstCall(transport).url).toBe(`${API}/api/chat/history?limit=50`);
  });

  it('sends starting_after with the limit for the next page (encoded)', async () => {
    const { transport, client } = answering([{ id: 'c-2', title: 'Older' }]);
    const rows = await fetchHistory(client, 20, 'c 1');
    expect(rows.map((row) => row.id)).toEqual(['c-2']);
    expect(firstCall(transport).url).toBe(`${API}/api/chat/history?limit=20&starting_after=c%201`);
  });

  it('leaves the cursor out when it is null', async () => {
    const { transport, client } = answering([]);
    await fetchHistory(client, 50, null);
    expect(firstCall(transport).url).toBe(`${API}/api/chat/history?limit=50`);
  });
});

describe('fetchAgents', () => {
  it('reads the agents list', async () => {
    const { transport, client } = answering({
      agents: [{ id: 1, name: 'Auto', is_default: true, model_config: {} }],
    });
    await expect(fetchAgents(client)).resolves.toEqual([
      { id: 1, name: 'Auto', agent_type: null, description: null, is_default: true },
    ]);
    expect(firstCall(transport).url).toBe(`${API}/api/chat/agents`);
  });
});
