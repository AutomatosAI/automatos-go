// app/(app)/chat/[id].tsx's parameter, pure: routes.chat(id) opens that conversation (checked
// before reuse, D-STALE-CHAT); routes.chat('new') opens a draft, which its first message creates.

import { isUsableId, type RouteParams } from '../../navigation/routes';

/** The id routes.chat takes for a conversation that does not exist yet. */
export const NEW_CHAT_ID = 'new';

/** The chat the route names, or null for a draft ('new', or no usable id). */
export function routeChatId(params: RouteParams): string | null {
  const value = params.id;
  const id = (Array.isArray(value) ? value[0] : value)?.trim();
  return id && id !== NEW_CHAT_ID && isUsableId(id) ? id : null;
}
