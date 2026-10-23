// Is this chat still the user's (D-STALE-CHAT)? POST /api/chat with a stale or unknown id silently
// creates a NEW chat (automatos-ai api/chat.py _open_chat), so a cached id is checked with GET
// /api/chat/{id} before it is reused: not_found (gone) or forbidden (another user's) starts a draft.
// Every call asks the server; the answer lives only in this launch's memory (chat.thread is never
// persisted, query-keys.ts), so no id checked on an earlier launch is ever reused unchecked. Any other
// failure is thrown: the chat may well be there, so the caller retries rather than start a draft.

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import type { ChatChanged } from '../../api/live-events';
import { fetchChat } from '../api';
import type { ChatThread } from '../schemas';

/** The chat with its turnInFlight, or null when the id may not be reused (404, 403). */
export async function checkChat(
  client: ApiClient,
  chatId: string,
  signal?: AbortSignal,
): Promise<ChatThread | null> {
  try {
    return await fetchChat(client, chatId, signal);
  } catch (error) {
    if (isApiError(error) && (error.kind === 'not_found' || error.kind === 'forbidden'))
      return null;
    throw error;
  }
}

/** The id when the server still answers for it; null (start a draft) for none, 404 or 403. */
export async function ensureLiveChatId(
  client: ApiClient,
  cachedId: string | null,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!cachedId) return null;
  const thread = await checkChat(client, cachedId, signal);
  return thread ? thread.id : null;
}

/** A chat_changed frame about the conversation on screen (a draft has none). */
export function isChatChangedFor(chatId: string | null, data: ChatChanged): boolean {
  return chatId !== null && data.chat_id === chatId;
}
