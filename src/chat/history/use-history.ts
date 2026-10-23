// The older chats list's reads, wired only (the rules are history.ts's): GET /api/chat/history 50 at
// a time, each next page after the last id loaded, asked again each time the list opens so a chat
// started since is on it (the web's refetchOnMount). The family stays in memory (D-CACHE).

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '../../api/query-keys';
import { useApiClient } from '../../app-state/session';
import { HISTORY_PAGE_SIZE, fetchHistory } from '../api';
import {
  historyFooter,
  historyState,
  mergePages,
  nextCursor,
  type HistoryFooter,
  type HistoryState,
} from './history';

export type ChatHistory = {
  readonly state: HistoryState;
  readonly footer: HistoryFooter;
  /** Why the first page failed (an ApiError), for ErrorState's words. */
  readonly error: unknown;
  readonly retry: () => void;
  readonly loadMore: () => void;
};

export function useChatHistory(): ChatHistory {
  const client = useApiClient();
  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.history(HISTORY_PAGE_SIZE),
    queryFn: ({ pageParam, signal }) => fetchHistory(client, HISTORY_PAGE_SIZE, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (_last, pages) => nextCursor(mergePages(pages, HISTORY_PAGE_SIZE)),
    refetchOnMount: 'always',
  });
  const { data, error, isError, isFetching, refetch, fetchNextPage } = query;
  const list = useMemo(() => (data ? mergePages(data.pages, HISTORY_PAGE_SIZE) : null), [data]);
  const retry = useCallback(() => void refetch(), [refetch]);
  // a tap during a background refetch waits for it rather than cancelling it
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);
  return {
    state: historyState({ list, isError, isFetching }),
    footer: historyFooter(query),
    error,
    retry,
    loadMore,
  };
}
