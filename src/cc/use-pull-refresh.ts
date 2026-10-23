// Pull to refresh for a Command Centre list: the spinner shows while the user's own pull refetches
// (a live or resume refetch never spins it), and a failed pull says why in the app's one toast, in
// the taxonomy's words, while the list keeps what it last had. Live updates need no pull: the
// foundation's stream invalidates the queries (D-LIVE), and nothing here polls.

import { useCallback, useState } from 'react';

import { userMessage } from '../api/errors';
import { useToast } from '../ui';

export type PullRefresh = {
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
};

/** A query's refetch: TanStack resolves it with the result, an error included, never a throw. */
export type Refetch = () => Promise<{ readonly error: unknown }>;

export function usePullRefresh(refetch: Refetch): PullRefresh {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch()
      .then((result) => {
        if (result.error) toast.show(userMessage(result.error));
      })
      .catch((error: unknown) => toast.show(userMessage(error)))
      .finally(() => setRefreshing(false));
  }, [refetch, toast]);
  return { refreshing, onRefresh };
}
