// The team in React (US-023j), as Arcade's useArcadeParty reads the party: the chat's agents read
// (agentsQuery, its own query under queryKeys.chat.agents, GET /api/chat/agents), needs-you's rows
// the home already holds, and the Board's query the Command Centre makes (boardQuery); no new
// endpoint, no fetch outside src/api. The agents' read failing with nothing read before is the
// view's failure, with its Try again; a refetch that fails keeps the agents already read.

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { NeedsYouRows } from '../../../api/needs-you';
import { useApiClient } from '../../../app-state/session';
import { boardQuery } from '../../../cc/board/api';
import { agentsQuery } from '../../../chat/api';
import { teamOf, type Team } from './team';

export type TeamRead = {
  /** The team once the agents are read; null before. */
  readonly team: Team | null;
  /** The agents' read failed with nothing to show: its error; else null. */
  readonly error: Error | null;
  readonly retry: () => void;
};

export function useTeam(needsYou: NeedsYouRows): TeamRead {
  const client = useApiClient();
  const read = useQuery(agentsQuery(client));
  const board = useQuery(boardQuery(client)).data?.tasks ?? null;
  const agents = read.data ?? null;
  const team = useMemo(() => teamOf({ agents, needsYou, board }), [agents, needsYou, board]);
  const { refetch } = read;
  const retry = useCallback(() => void refetch(), [refetch]);
  return { team, error: agents === null ? read.error : null, retry };
}
