// Home's own rules, pure. The header's mono line is the workspace and its agents, or Auto working
// while a turn runs (the prototype's 'Northwind · {{ autoStatus }}'). The home thread (KC4) is the
// newest conversation in GET /api/chat/history, opened through useThread's stale check, or a draft
// when there is none; it is chosen once per visit, so a later refetch that lists another chat as
// newest never swaps the thread under the user.

import { countPhrase } from '../../ui/variants';
import type { HistoryRow } from '../schemas';
import { HOME_COPY } from '../strings';

const LINE_SEPARATOR = ' · ';

export type HeaderLineInput = {
  readonly workspace: string;
  /** The agents Auto can hand a chat to; null until GET /api/chat/agents answers. */
  readonly agents: number | null;
  /** A turn streams, or a reopened chat's turn runs on the server (the thread's canStop). */
  readonly working: boolean;
};

function status(agents: number | null, working: boolean): string | null {
  if (working) return HOME_COPY.working;
  return agents === null ? null : countPhrase(agents, HOME_COPY.agents);
}

/** 'Northwind · 5 agents', 'Northwind · Auto is working', or the name alone. */
export function headerLine({ workspace, agents, working }: HeaderLineInput): string {
  return [workspace.trim(), status(agents, working)].filter(Boolean).join(LINE_SEPARATOR);
}

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
