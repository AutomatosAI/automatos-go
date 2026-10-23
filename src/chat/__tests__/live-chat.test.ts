import { describe, expect, it } from 'vitest';

import { jsonReply, reply } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { checkChat, ensureLiveChatId, isChatChangedFor } from '../controller/live-chat';
import {
  AT,
  CHAT_ID,
  OTHER_CHAT_ID,
  WORKSPACE_ID,
  callsTo,
  clientWith,
  routedTransport,
} from './thread-fixtures';

const CHAT = {
  id: CHAT_ID,
  title: 'Plan my week',
  createdAt: AT,
  updatedAt: AT,
  kind: 'user',
  visibility: 'private',
  turnInFlight: true,
};
const PATH = `/api/chat/${CHAT_ID}`;

function answering(status: number, value: unknown) {
  const transport = routedTransport({
    [`GET ${PATH}`]: () => (status === 200 ? jsonReply(200, value) : reply(status, '')),
  });
  return { transport, client: clientWith(transport) };
}

describe('ensureLiveChatId (D-STALE-CHAT)', () => {
  it('reuses the id when GET /api/chat/{id} answers', async () => {
    const { transport, client } = answering(200, CHAT);
    await expect(ensureLiveChatId(client, CHAT_ID)).resolves.toBe(CHAT_ID);
    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      headers: { 'X-Workspace-ID': WORKSPACE_ID },
    });
  });

  it('starts a draft (null) on 404 and 403, and sends nothing for no id', async () => {
    await expect(ensureLiveChatId(answering(404, null).client, CHAT_ID)).resolves.toBeNull();
    await expect(ensureLiveChatId(answering(403, null).client, CHAT_ID)).resolves.toBeNull();
    const { transport, client } = answering(200, CHAT);
    await expect(ensureLiveChatId(client, null)).resolves.toBeNull();
    expect(transport.calls).toHaveLength(0);
  });

  it('asks the server every time: an id answered before is checked again', async () => {
    const { transport, client } = answering(200, CHAT);
    await ensureLiveChatId(client, CHAT_ID);
    await ensureLiveChatId(client, CHAT_ID);
    expect(callsTo(transport, 'GET', PATH)).toHaveLength(2);
  });

  it('throws any other failure: the chat may be there, so it is retried, not replaced', async () => {
    const error = await ensureLiveChatId(answering(500, null).client, CHAT_ID).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', status: 500 });
  });
});

describe('checkChat', () => {
  it('answers the chat with turnInFlight, unknown fields dropped', async () => {
    const chat = await checkChat(answering(200, CHAT).client, CHAT_ID);
    expect(chat).toEqual({
      id: CHAT_ID,
      title: 'Plan my week',
      createdAt: AT,
      updatedAt: AT,
      kind: 'user',
      turnInFlight: true,
    });
    await expect(checkChat(answering(404, null).client, CHAT_ID)).resolves.toBeNull();
  });
});

describe('isChatChangedFor', () => {
  const changed = { workspace_id: 'w', chat_id: CHAT_ID };
  it('is true only for the conversation on screen', () => {
    expect(isChatChangedFor(CHAT_ID, changed)).toBe(true);
    expect(isChatChangedFor(OTHER_CHAT_ID, changed)).toBe(false);
    expect(isChatChangedFor(null, changed)).toBe(false);
  });
});
