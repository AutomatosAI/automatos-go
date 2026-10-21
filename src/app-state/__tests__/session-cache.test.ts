import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_HEADER } from '../../api/auth-headers';
import { createApiClient } from '../../api/client';
import {
  QUERY_CACHE_STORAGE_KEY,
  createQueryClient,
  createQueryPersister,
  persistOptions,
} from '../../api/query-client';
import { queryKeys } from '../../api/query-keys';
import { createWorkspaceIdStore, type WorkspaceIdStore } from '../../api/workspace';
import { memoryStorage } from '../../storage/encrypted-storage';
import {
  SERVER,
  fakeTransport,
  flush,
  jsonReply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import {
  forgetSession,
  forgetWorkspaceData,
  launchBootstrap,
  seedWorkspaceId,
} from '../session-cache';

const HELD = '7f1c2a54-0000-4000-8000-000000000001';
const OTHER = '7f1c2a54-0000-4000-8000-000000000002';
const API = 'https://api.example.test';

function current(id: string) {
  return { id, name: 'Workspace', role: 'editor' };
}

function clientWith(transport: FakeTransport, store: WorkspaceIdStore) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: store.get,
    transport,
  });
}

/** One cached query per kind: the server's, the workspace itself and the workspace's own data. */
function seedCache(queryClient = createQueryClient()) {
  queryClient.setQueryData(queryKeys.discovery(API), { capabilities: [] });
  queryClient.setQueryData(queryKeys.workspace(), current(HELD));
  queryClient.setQueryData(queryKeys.board(), { tasks: [{ id: 1 }] });
  queryClient.setQueryData(queryKeys.questions('pending', 'question'), { grants: [] });
  queryClient.setQueryData(queryKeys.chat.history(), [{ id: 'c-1' }]);
  queryClient.setQueryData(queryKeys.deliverables(HELD), { items: [] });
  return queryClient;
}

function cachedKeys(queryClient: ReturnType<typeof createQueryClient>): unknown[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
}

describe('seedWorkspaceId', () => {
  it('seeds an empty store with the restored workspace id', () => {
    const store = createWorkspaceIdStore();
    seedWorkspaceId(store, current(HELD));
    expect(store.get()).toBe(HELD);
  });

  it('never replaces an id the store already holds', () => {
    const store = createWorkspaceIdStore(OTHER);
    seedWorkspaceId(store, current(HELD));
    expect(store.get()).toBe(OTHER);
  });

  it('ignores a restored copy it cannot read', () => {
    for (const restored of [undefined, null, {}, { id: 'not-a-uuid' }, 'text', { id: 42 }]) {
      const store = createWorkspaceIdStore();
      seedWorkspaceId(store, restored);
      expect(store.get()).toBeNull();
    }
  });
});

describe('launchBootstrap', () => {
  it('asks for the workspace the restored copy was in, and stores what the server says', async () => {
    const queryClient = seedCache();
    const store = createWorkspaceIdStore();
    const transport = fakeTransport(() => jsonReply(200, current(HELD)));
    const workspace = await launchBootstrap(clientWith(transport, store), queryClient, { store });
    expect(transport.calls[0].headers[WORKSPACE_HEADER]).toBe(HELD);
    expect(workspace.id).toBe(HELD);
    expect(store.get()).toBe(HELD);
  });

  it('keeps every cached query when the server resolves the same workspace', async () => {
    const queryClient = seedCache();
    const store = createWorkspaceIdStore();
    const before = cachedKeys(queryClient);
    const transport = fakeTransport(() => jsonReply(200, current(HELD)));
    await launchBootstrap(clientWith(transport, store), queryClient, { store });
    expect(cachedKeys(queryClient)).toEqual(before);
  });

  it("drops the old workspace's data when the server resolved another one", async () => {
    const queryClient = seedCache();
    const store = createWorkspaceIdStore();
    const transport = fakeTransport(() => jsonReply(200, current(OTHER)));
    await launchBootstrap(clientWith(transport, store), queryClient, { store });
    expect(cachedKeys(queryClient)).toEqual([queryKeys.discovery(API), queryKeys.workspace()]);
    expect(store.get()).toBe(OTHER);
  });

  it('sends no workspace header on a first launch with nothing restored', async () => {
    const queryClient = createQueryClient();
    const store = createWorkspaceIdStore();
    const transport = fakeTransport(() => jsonReply(200, current(OTHER)));
    await launchBootstrap(clientWith(transport, store), queryClient, { store });
    expect(transport.calls[0].headers[WORKSPACE_HEADER]).toBeUndefined();
    expect(store.get()).toBe(OTHER);
  });
});

describe('forgetWorkspaceData', () => {
  it("cancels the old workspace's calls in flight, so none lands after the change", async () => {
    const queryClient = seedCache();
    let release: (value: unknown) => void = () => undefined;
    const late = queryClient.fetchQuery({
      queryKey: queryKeys.needsYou(),
      queryFn: () => new Promise((resolve) => (release = resolve)),
    });
    await flush();
    await forgetWorkspaceData(queryClient);
    release({ total: 9 });
    await expect(late).rejects.toThrow();
    expect(queryClient.getQueryData(queryKeys.needsYou())).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.discovery(API))).toEqual({ capabilities: [] });
  });

  it('saves the smaller cache to the phone', async () => {
    const queryClient = seedCache();
    const storage = memoryStorage();
    const persister = createQueryPersister(storage);
    await forgetWorkspaceData(queryClient);
    await persistQueryClientSave({ queryClient, ...persistOptions(persister, 'user_2abc') });
    const saved = JSON.parse(storage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '{}') as {
      clientState: { queries: { queryKey: unknown }[] };
    };
    expect(saved.clientState.queries.map((query) => query.queryKey)).toEqual([
      queryKeys.discovery(API),
      queryKeys.workspace(),
    ]);
  });
});

describe('forgetSession', () => {
  it('forgets the workspace id, every cached query and the saved copy', async () => {
    const queryClient = seedCache();
    const storage = memoryStorage();
    const persister = createQueryPersister(storage);
    await persistQueryClientSave({ queryClient, ...persistOptions(persister, 'user_2abc') });
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();
    const store = createWorkspaceIdStore(HELD);

    await forgetSession(queryClient, persister, store);

    expect(store.get()).toBeNull();
    expect(cachedKeys(queryClient)).toEqual([]);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });
});
