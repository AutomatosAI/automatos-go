// Home's read, wired only (the rules are home.ts's). The home thread (KC4): the newest chat in
// GET /api/chat/history, read fresh on every visit and kept once chosen; useThread then checks it
// before reuse (a stale id starts a draft). The family stays in memory (D-CACHE, query-keys.ts).

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { queryKeys } from '../../api/query-keys';
import { useApiClient } from '../../app-state/session';
import { fetchHistory } from '../api';
import { keptChatId, newestChatId } from './home';

/** Home needs only the newest chat; the older chats list reads its own pages (US-008g). */
export const HOME_HISTORY_LIMIT = 1;

export type HomeChat = {
  /** The chat to open, null for a draft, undefined while the list is out. */
  readonly chatId: string | null | undefined;
  readonly error: unknown;
  readonly retry: () => void;
};

export function useHomeChat(): HomeChat {
  const client = useApiClient();
  const history = useQuery({
    queryKey: queryKeys.chat.history(HOME_HISTORY_LIMIT),
    queryFn: ({ signal }) => fetchHistory(client, HOME_HISTORY_LIMIT, null, signal),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const fresh = history.isFetchedAfterMount && history.isSuccess ? history.data : undefined;
  const newest = newestChatId(fresh);
  const [kept, setKept] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (kept === undefined && newest !== undefined) setKept(newest);
  }, [kept, newest]);
  const { refetch } = history;
  const retry = useCallback(() => void refetch(), [refetch]);
  const chatId = keptChatId(kept, newest);
  // a retry in flight shows loading, not the failure it may fix
  const failed = chatId === undefined && !history.isFetching;
  return { chatId, error: failed ? history.error : null, retry };
}
