// Home's own rules, pure. The home thread (KC4) is the newest conversation in GET
// /api/chat/history, opened through useThread's stale check, or a draft when there is none; it is
// chosen once per visit, so a later refetch that lists another chat as newest never swaps the
// thread under the user.

import type { HistoryRow } from '../schemas';

/** The newest chat's id; null for a draft (no chats yet); undefined while the list is out. */
export function newestChatId(
  history: readonly HistoryRow[] | undefined,
): string | null | undefined {
  if (history === undefined) return undefined;
  return history[0]?.id ?? null;
}

/** The home thread once chosen stays for the visit; until then, whatever the list says. */
export function keptChatId(
  kept: string | null | undefined,
  newest: string | null | undefined,
): string | null | undefined {
  return kept === undefined ? newest : kept;
}
