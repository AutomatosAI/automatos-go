// The app's QueryClient and its persister (PRD-001 §4.4, D-CACHE). The cache is kept across launches
// in the encrypted MMKV store (src/storage), but only the families query-keys.ts marks persistable
// (workspace, discovery, board, schedule, deliverables lists): chat messages, chat threads and
// question text stay in memory. Mutations are never persisted and never queued offline: an answer,
// an approval or a pause either reaches the server now or fails, because the server's
// compare-and-swap answer is the truth. The app shell wires these into PersistQueryClientProvider
// and must not call resumePausedMutations (there are none to resume).

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions, Persister } from '@tanstack/react-query-persist-client';

import type { KeyValueStorage } from '../storage/encrypted-storage';
import { isApiError } from './errors';
import { isPersistableKey } from './query-keys';

/** The one MMKV item that holds the persisted cache. */
export const QUERY_CACHE_STORAGE_KEY = 'automatos.query-cache';
/** Bump when a persisted family's shape changes: a cache saved under another buster is dropped. */
export const QUERY_CACHE_BUSTER = 'automatos-go-cache-v1';
/** A persisted cache older than this is dropped on restore. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Cache writes are batched to at most one per this interval. */
export const PERSIST_THROTTLE_MS = 1_000;
/** A query is refetched on use once older than this. */
export const QUERY_STALE_TIME_MS = 30_000;
/** At least the persist max age, or a restored query is collected before anyone reads it. */
export const QUERY_GC_TIME_MS = PERSIST_MAX_AGE_MS;
/** A failed query is tried again at most this many times, and only when trying can help. */
export const QUERY_MAX_RETRIES = 2;

const SERVER_ERROR_FLOOR = 500;

/** Worth trying again: the network, a 5xx, a broken stream. Never a refusal (401, 403, 404, 4xx). */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.kind === 'network' || error.kind === 'stream') return true;
  return error.kind === 'server' && (error.status ?? 0) >= SERVER_ERROR_FLOOR;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < QUERY_MAX_RETRIES && isRetryable(error);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: shouldRetryQuery,
      },
      // 'always': sent at once whatever the connection, never paused to replay later; no retry
      mutations: { networkMode: 'always', retry: false },
    },
  });
}

/** Only a successful query of a persistable family is written to the phone. */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && isPersistableKey(query.queryKey);
}

export function shouldPersistMutation(): boolean {
  return false;
}

export function createQueryPersister(storage: KeyValueStorage): Persister {
  return createAsyncStoragePersister({
    storage,
    key: QUERY_CACHE_STORAGE_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
  });
}

/**
 * The cache belongs to the one person signed in when it was saved (their Clerk user id, or a paired
 * device's id): restored for anyone else, TanStack discards it, so a sign-out whose clean-up never
 * finished (the app killed mid-way) still cannot show one person's data to the next.
 */
export function cacheBuster(ownerId: string): string {
  if (!ownerId) throw new TypeError('the persisted cache needs the signed-in owner id');
  return `${QUERY_CACHE_BUSTER}:${ownerId}`;
}

/** PersistQueryClientProvider's persistOptions, mounted only while someone is signed in. */
export function persistOptions(
  persister: Persister,
  ownerId: string,
): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: cacheBuster(ownerId),
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      shouldDehydrateMutation: shouldPersistMutation,
    },
  };
}

/**
 * Forget everything cached, in memory and on the phone. Sign-out calls it, and so does a bootstrap
 * that comes back with a different workspace id, so one person's or one workspace's data is never
 * shown to the next. clear() hands its removal events to the persist subscription synchronously
 * (QueryCache.notify calls listeners inside notifyManager.batch), so a throttled write still
 * waiting when the stored copy is removed saves the empty cache, never the old one.
 */
export async function clearQueryCache(
  queryClient: QueryClient,
  persister: Persister,
): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  await persister.removeClient();
}
