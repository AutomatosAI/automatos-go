import { dehydrate, onlineManager, type QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { memoryStorage, type KeyValueStorage } from '../../storage/encrypted-storage';
import { ApiError } from '../errors';
import {
  PERSIST_MAX_AGE_MS,
  PERSIST_THROTTLE_MS,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_GC_TIME_MS,
  QUERY_MAX_RETRIES,
  cacheBuster,
  clearQueryCache,
  createQueryClient,
  createQueryPersister,
  isRetryable,
  persistOptions,
  shouldRetryQuery,
} from '../query-client';
import { queryKeys } from '../query-keys';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

/** Fills the cache with one success per family, as the screens will. */
function seed(queryClient: QueryClient): void {
  queryClient.setQueryData(queryKeys.workspace(), { id: WS, role: 'editor' });
  queryClient.setQueryData(queryKeys.discovery('https://api.example.test'), { capabilities: [] });
  queryClient.setQueryData(queryKeys.board(), { tasks: [{ id: 1, title: 'Draft the post' }] });
  queryClient.setQueryData(queryKeys.schedule('7d'), { scheduled: [] });
  queryClient.setQueryData(queryKeys.deliverables(WS), { items: [] });
  queryClient.setQueryData(queryKeys.chat.messages('c-1'), [{ text: 'private chat body' }]);
  queryClient.setQueryData(queryKeys.chat.thread('c-1'), { id: 'c-1', title: 'Secret plans' });
  queryClient.setQueryData(queryKeys.chat.history(), [{ id: 'c-1', last: 'private line' }]);
  queryClient.setQueryData(queryKeys.questions('pending', 'question'), {
    grants: [{ question: 'Private question text?' }],
  });
  queryClient.setQueryData(queryKeys.needsYou(), { total: 3 });
  queryClient.setQueryData(queryKeys.ticket('42'), { id: 42 });
  queryClient.setQueryData(queryKeys.deliverable(WS, 'd-1', true), { content: 'body' });
}

const OWNER = 'user_2abcOwnerA';
const NEXT_OWNER = 'user_2abcOwnerB';

function setup(ownerId = OWNER, storage = memoryStorage()) {
  const persister = createQueryPersister(storage);
  const queryClient = createQueryClient();
  const options = { queryClient, ...persistOptions(persister, ownerId) };
  return { storage, persister, queryClient, options };
}

function persistedKeys(storage: KeyValueStorage): unknown[] {
  const raw = storage.getItem(QUERY_CACHE_STORAGE_KEY);
  if (!raw) return [];
  const client = JSON.parse(raw) as { clientState: { queries: { queryKey: unknown }[] } };
  return client.clientState.queries.map((query) => query.queryKey);
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('the persister', () => {
  it('writes only the persistable families: workspace, discovery, board, schedule, deliverables', async () => {
    const { storage, queryClient, options } = setup();
    seed(queryClient);
    await persistQueryClientSave(options);
    expect(persistedKeys(storage)).toEqual([
      queryKeys.workspace(),
      queryKeys.discovery('https://api.example.test'),
      queryKeys.board(),
      queryKeys.schedule('7d'),
      queryKeys.deliverables(WS),
    ]);
  });

  it('never writes chat bodies, chat threads, chat history or question text', async () => {
    const { storage, queryClient, options } = setup();
    seed(queryClient);
    await persistQueryClientSave(options);
    const raw = storage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '';
    for (const secret of [
      'private chat body',
      'Secret plans',
      'private line',
      'Private question text?',
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('writes only successful queries', async () => {
    const { storage, queryClient, options } = setup();
    await queryClient
      .fetchQuery({
        queryKey: queryKeys.board(),
        queryFn: () => Promise.reject(new ApiError('forbidden', { status: 403 })),
        retry: false,
      })
      .catch(() => undefined);
    await persistQueryClientSave(options);
    expect(persistedKeys(storage)).toEqual([]);
  });

  it('never persists a mutation, even one paused offline', async () => {
    const { storage, queryClient, options } = setup();
    onlineManager.setOnline(false);
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['answer'],
      mutationFn: async () => 'answered',
      networkMode: 'online', // a caller that overrode the default: it pauses offline
    });
    void mutation.execute(undefined).catch(() => undefined);
    await Promise.resolve();
    expect(mutation.state.isPaused).toBe(true);

    expect(dehydrate(queryClient).mutations).toHaveLength(1); // the library's default would keep it
    expect(dehydrate(queryClient, options.dehydrateOptions).mutations).toHaveLength(0);
    await persistQueryClientSave(options);
    const raw = JSON.parse(storage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '{}');
    expect(raw.clientState.mutations).toEqual([]);
  });

  it('restores what it wrote, and drops a cache saved under another buster', async () => {
    const first = setup();
    seed(first.queryClient);
    await persistQueryClientSave(first.options);

    const restored = createQueryClient();
    await persistQueryClientRestore({ ...first.options, queryClient: restored });
    expect(restored.getQueryData(queryKeys.workspace())).toEqual({ id: WS, role: 'editor' });
    expect(restored.getQueryData(queryKeys.chat.messages('c-1'))).toBeUndefined();

    const busted = createQueryClient();
    await persistQueryClientRestore({ ...first.options, queryClient: busted, buster: 'older' });
    expect(busted.getQueryData(queryKeys.workspace())).toBeUndefined();
    expect(first.storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("never restores one person's cache for the next, even when sign-out never cleaned up", async () => {
    const first = setup(OWNER);
    seed(first.queryClient);
    await persistQueryClientSave(first.options); // and then the app is killed before clearing

    const next = setup(NEXT_OWNER, first.storage);
    await persistQueryClientRestore(next.options);
    expect(next.queryClient.getQueryCache().getAll()).toEqual([]);
    expect(first.storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('is keyed, busted and aged by the named constants', () => {
    const { options } = setup();
    expect(options.buster).toBe(`${QUERY_CACHE_BUSTER}:${OWNER}`);
    expect(options.buster).toBe(cacheBuster(OWNER));
    expect(options.maxAge).toBe(PERSIST_MAX_AGE_MS);
    expect(QUERY_GC_TIME_MS).toBeGreaterThanOrEqual(PERSIST_MAX_AGE_MS);
  });

  it('refuses to persist without an owner', () => {
    expect(() => cacheBuster('')).toThrow(TypeError);
  });
});

describe('clearQueryCache', () => {
  it('forgets everything, in memory and on the phone, and a pending write cannot bring it back', async () => {
    vi.useFakeTimers();
    try {
      const { storage, persister, queryClient, options } = setup();
      const unsubscribe = persistQueryClientSubscribe(options);
      seed(queryClient); // many cache events: one write now, the latest state after the throttle
      await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
      expect(persistedKeys(storage)).toHaveLength(5);

      queryClient.setQueryData(queryKeys.board(), { tasks: [] }); // a write now waits its turn
      await clearQueryCache(queryClient, persister);
      expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull(); // gone at once, not at the next write
      await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS * 2); // the waiting write runs (not gc)
      unsubscribe();

      expect(queryClient.getQueryCache().getAll()).toEqual([]);
      expect(persistedKeys(storage)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the QueryClient defaults', () => {
  it('sends mutations at once, offline or not, and never retries them', async () => {
    const queryClient = createQueryClient();
    const mutations = queryClient.getDefaultOptions().mutations;
    expect(mutations?.networkMode).toBe('always');
    expect(mutations?.retry).toBe(false);

    onlineManager.setOnline(false);
    const mutationFn = vi.fn(async () => {
      throw new ApiError('network');
    });
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn });
    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiError);
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutation.state.isPaused).toBe(false);
  });

  it('retries only what trying again can fix', () => {
    expect(isRetryable(new ApiError('network'))).toBe(true);
    expect(isRetryable(new ApiError('stream'))).toBe(true);
    expect(isRetryable(new ApiError('server', { status: 503 }))).toBe(true);
    expect(isRetryable(new ApiError('server', { status: 429 }))).toBe(false);
    expect(isRetryable(new ApiError('server'))).toBe(false);
    for (const kind of [
      'auth',
      'forbidden',
      'not_found',
      'conflict',
      'invalid_response',
    ] as const) {
      expect(isRetryable(new ApiError(kind))).toBe(false);
    }
    expect(isRetryable(new Error('not an ApiError'))).toBe(false);
  });

  it('stops after the named number of retries', () => {
    const network = new ApiError('network');
    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(QUERY_MAX_RETRIES - 1, network)).toBe(true);
    expect(shouldRetryQuery(QUERY_MAX_RETRIES, network)).toBe(false);
  });
});
