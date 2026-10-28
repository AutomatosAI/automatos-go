// The chat's calls (D-ONE-CLIENT): every one through the foundation's client and stream, every
// answer parsed with src/chat/schemas.ts. A turn is a detached producer on the server, so aborting
// sendTurn only stops the read; Stop is cancelTurn as well (D-STOP). Auto's card actions live with
// their cards (src/chat/cards/). Failures are the client's ApiError taxonomy (src/api/errors.ts).

import type { Frame } from '../core/ai-sdk-stream';
import type { ApiClient } from '../api/client';
import { CHAT_TURN_CONNECT_TIMEOUT_MS } from '../api/config';
import { streamTurn, type StreamOutcome } from '../api/stream';
import type { ChatRequestBody } from './request';
import { CHAT_ROUTES } from './routes';
import {
  CancelResultSchema,
  ChatAgentsSchema,
  ChatThreadSchema,
  HistorySchema,
  StoredMessagesSchema,
  type CancelResult,
  type ChatAgent,
  type ChatThread,
  type HistoryRow,
  type StoredMessage,
} from './schemas';

/** Older chats are listed 50 at a time (PRD-001 open question 3). */
export const HISTORY_PAGE_SIZE = 50;

/**
 * One turn: each line of the body as a Frame, in order, until it ends or `signal` aborts. Its status
 * may take up to CHAT_TURN_CONNECT_TIMEOUT_MS (the server picks who answers first); the body as long
 * as chunks come.
 */
export function sendTurn(
  client: Pick<ApiClient, 'stream'>,
  body: ChatRequestBody,
  onFrame: (frame: Frame) => void,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  return streamTurn(client, CHAT_ROUTES.send, body, onFrame, signal, CHAT_TURN_CONNECT_TIMEOUT_MS);
}

/** Stop on the server; {cancelled: false} when no turn was running. */
export function cancelTurn(
  client: ApiClient,
  chatId: string,
  signal?: AbortSignal,
): Promise<CancelResult> {
  return client.request(CHAT_ROUTES.cancel, {
    params: { chat_id: chatId },
    schema: CancelResultSchema,
    signal,
  });
}

/** One chat with turnInFlight; not_found (404) when it is gone, forbidden (403) when not ours. */
export function fetchChat(
  client: ApiClient,
  chatId: string,
  signal?: AbortSignal,
): Promise<ChatThread> {
  return client.request(CHAT_ROUTES.chat, {
    params: { chat_id: chatId },
    schema: ChatThreadSchema,
    signal,
  });
}

export function fetchMessages(
  client: ApiClient,
  chatId: string,
  signal?: AbortSignal,
): Promise<StoredMessage[]> {
  return client.request(CHAT_ROUTES.messages, {
    params: { chat_id: chatId },
    schema: StoredMessagesSchema,
    signal,
  });
}

/**
 * A page of the caller's chats, newest activity first. starting_after is sent although the server
 * reads only `limit` today (PRD-266 §4.9 adds it): the list's paging dedupes by id (US-008g).
 */
export function fetchHistory(
  client: ApiClient,
  limit: number = HISTORY_PAGE_SIZE,
  startingAfter?: string | null,
  signal?: AbortSignal,
): Promise<HistoryRow[]> {
  return client.request(CHAT_ROUTES.history, {
    query: { limit, starting_after: startingAfter ?? undefined },
    schema: HistorySchema,
    signal,
  });
}

export async function fetchAgents(client: ApiClient, signal?: AbortSignal): Promise<ChatAgent[]> {
  const { agents } = await client.request(CHAT_ROUTES.agents, { schema: ChatAgentsSchema, signal });
  return agents;
}
