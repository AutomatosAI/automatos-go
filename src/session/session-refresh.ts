// role-refresh.ts applied to the app's QueryClient (KC12), with no React: the refresher reads when
// the workspace was last read, asks refreshDecision, and invalidates the foundation's workspace key
// family, so the gate's workspace query (use-launch.ts) reads GET /api/workspaces/current again and
// every screen re-gates through roleCan on the new role. The refusals are heard by subscribing to
// the client's query and mutation caches from outside (src/api/query-client.ts is not edited).
// use-session-refresh.ts wires these to AppState; tests run them over a real QueryClient.

import type {
  MutationCacheNotifyEvent,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from '@tanstack/react-query';

import { matchesFamily, queryKeys } from '../api/query-keys';
import { isForbidden, refreshDecision, type RefreshEvent } from './role-refresh';

const isWorkspaceQuery = (query: Query): boolean => matchesFamily('workspace', query.queryKey);

/** When the workspace was last read, an answer or a refusal; null when it never was. */
export function lastWorkspaceRead(queryClient: QueryClient): number | null {
  const state = queryClient.getQueryState(queryKeys.workspace());
  const at = Math.max(state?.dataUpdatedAt ?? 0, state?.errorUpdatedAt ?? 0);
  return at > 0 ? at : null;
}

/**
 * Reads the workspace again. A read already in flight is joined, never cancelled and sent twice
 * (cancelRefetch false); only a mounted (active) workspace query is refetched.
 */
export function refreshWorkspace(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: isWorkspaceQuery }, { cancelRefetch: false });
}

export type SessionRefresher = (event: RefreshEvent) => boolean;

/** Handles one event: true when it read the workspace again. */
export function createSessionRefresher(
  queryClient: QueryClient,
  now: () => number = Date.now,
): SessionRefresher {
  return (event) => {
    if (!refreshDecision(event, lastWorkspaceRead(queryClient), now())) return false;
    void refreshWorkspace(queryClient);
    return true;
  };
}

/** A query of any family but the workspace's own failed with a 403. */
export function forbiddenFromQuery(event: QueryCacheNotifyEvent): boolean {
  return (
    event.type === 'updated' &&
    event.action.type === 'error' &&
    isForbidden(event.action.error) &&
    !isWorkspaceQuery(event.query)
  );
}

/** A mutation (an answer, an approval, a pause, …) failed with a 403. */
export function forbiddenFromMutation(event: MutationCacheNotifyEvent): boolean {
  return (
    event.type === 'updated' && event.action.type === 'error' && isForbidden(event.action.error)
  );
}

/** Calls `onForbidden` for every refusal the caches hear; returns the unsubscribe. */
export function watchRefusals(queryClient: QueryClient, onForbidden: () => void): () => void {
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    if (forbiddenFromQuery(event)) onForbidden();
  });
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    if (forbiddenFromMutation(event)) onForbidden();
  });
  return () => {
    stopQueries();
    stopMutations();
  };
}
