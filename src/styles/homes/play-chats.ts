// Play's Conversations over A2's history (Ember 03, US-017g), pure: A2's rows (src/chat/history:
// GET /api/chat/history 50 at a time, merged by id, ended by a short page or an ignored cursor) as
// the Companion list's conversations, and what the list shows in the rows' place while the first
// page loads, when it failed, and when there is no chat yet. A2's preview is the newest message of
// either side, so it carries no speaker ('Auto: …' needs one); the history carries no report count,
// so no row has the badge until the server sends one.

import type { HistoryState } from '../../chat/history/history';
import type { HistoryRow } from '../../chat/schemas';
import type { PlayConversation } from '../play/companion/conversations';

/** One of A2's history rows as the Companion's list reads it. */
export function playConversationOf(row: HistoryRow): PlayConversation {
  const text = row.lastMessagePreview?.trim();
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    preview: text ? { text, from: null } : null,
    reports: 0,
  };
}

/** A2's merged list in its order (newest activity first). */
export function playConversationsOf(rows: readonly HistoryRow[]): readonly PlayConversation[] {
  return rows.map(playConversationOf);
}

/** What stands in the rows' place: the wait, the failure with Try again, or the first chat's nudge. */
export type ChatsPlaceholder = 'loading' | 'failed' | 'empty' | null;

export function chatsPlaceholder(state: HistoryState): ChatsPlaceholder {
  if (state.status !== 'loaded') return state.status;
  return state.list.rows.length === 0 ? 'empty' : null;
}
