// role-refresh.ts applied to the app's QueryClient (KC12), with no React: the refresher reads when
// the workspace was last read, asks refreshDecision, and invalidates the foundation's workspace key
// family, so the gate's workspace query (use-launch.ts) reads GET /api/workspaces/current again and
// every screen re-gates through roleCan on the new role. The refusals are heard through the session's
// refusal channel (refusals.ts): the launch client reports every 403 it sees, and the client's query
// and mutation caches are subscribed to from outside (src/api/query-client.ts is not edited) for
// anything that does not go through it; the channel tells each refusal once. use-session-refresh.ts
// wires these to AppState; tests run them over a real QueryClient.

import type {
  MutationCacheNotifyEvent,
  Query,
  QueryCacheNotifyEvent,
  QueryClient,
} from '@tanstack/react-query';

import type { ApiError } from '../api/errors';
import { matchesFamily, queryKeys } from '../api/query-keys';
import type { Refusals } from './refusals';
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

/** The 403 a query of any family but the workspace's own failed with; null for anything else. */
export function refusalOfQuery(event: QueryCacheNotifyEvent): ApiError | null {
  if (event.type !== 'updated' || event.action.type !== 'error') return null;
  const { error } = event.action;
  return isForbidden(error) && !isWorkspaceQuery(event.query) ? error : null;
}

/** The 403 a mutation (an answer, an approval, a pause, …) failed with; null for anything else. */
export function refusalOfMutation(event: MutationCacheNotifyEvent): ApiError | null {
  if (event.type !== 'updated' || event.action.type !== 'error') return null;
  const { error } = event.action;
  return isForbidden(error) ? error : null;
}

/** Calls `onForbidden` with every refusal the caches hear; returns the unsubscribe. */
export function watchRefusals(
  queryClient: QueryClient,
  onForbidden: (error: ApiError) => void,
): () => void {
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    const refusal = refusalOfQuery(event);
    if (refusal) onForbidden(refusal);
  });
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    const refusal = refusalOfMutation(event);
    if (refusal) onForbidden(refusal);
  });
  return () => {
    stopQueries();
    stopMutations();
  };
}

/**
 * Calls `onForbidden` once per refusal, whoever heard it: the launch client's reports and the
 * caches' both go through `refusals`, so the same ApiError heard by both is one call. Returns the
 * unsubscribe.
 */
export function hearRefusals(
  queryClient: QueryClient,
  refusals: Refusals,
  onForbidden: () => void,
): () => void {
  const stopListening = refusals.listen(onForbidden);
  const stopWatching = watchRefusals(queryClient, refusals.report);
  return () => {
    stopWatching();
    stopListening();
  };
}
