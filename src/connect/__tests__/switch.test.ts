// Switching servers (US-006d): forgetServer() and connectTo(record) clear the query cache and its
// persisted copy (only the persister's own MMKV key), the stored X-Workspace-ID, the active provider
// and the consent step's memory, in that order, before the next server is used. Over the real
// QueryClient, persister and workspace-id registry; the provider, consent and keychain are fakes.

import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { describe, expect, it, vi } from 'vitest';

import {
  createQueryClient,
  createQueryPersister,
  persistOptions,
  QUERY_CACHE_STORAGE_KEY,
} from '../../api/query-client';
import { queryKeys } from '../../api/query-keys';
import { hostedServerFrom } from '../../api/server';
import type { AuthProvider } from '../../auth/providers/types';
import { createWorkspaceIdRegistry } from '../../session/workspace-ids';
import { memoryStorage } from '../../storage/encrypted-storage';
import { createCurrentServerStore, ownServerOf } from '../current-server';
import type { PairedRecord } from '../device-store';
import { createServerSwitch, type ServerSwitchDeps } from '../switch';
import { OTHER_RECORD, RECORD } from './paired-record';

const HOSTED = hostedServerFrom({ apiUrl: 'https://api.example.test', webUrl: '' });
const HOSTED_WORKSPACE = '11111111-1111-4111-8111-111111111111';
/** Another MMKV item of the app's store, kept beside the cache (a consent record, US-007b). */
const NEIGHBOUR_KEY = 'automatos.consent.v1|http://192.168.1.20:8000|ws';

type Kind = AuthProvider['kind'];

/** The app's ports over fakes that write what they did, in order, to one log. */
async function setup({ kind = 'clerk', paired = null as PairedRecord | null } = {}) {
  const log: string[] = [];
  const storage = memoryStorage();
  storage.setItem(NEIGHBOUR_KEY, 'agreed');
  const persister = createQueryPersister(storage);
  const queryClient = createQueryClient();
  queryClient.setQueryData(queryKeys.workspace(), { id: HOSTED_WORKSPACE });
  queryClient.setQueryData(queryKeys.board(), [{ id: 1 }]);
  await persistQueryClientSave({ queryClient, ...persistOptions(persister, 'owner') });

  const workspaceIds = createWorkspaceIdRegistry();
  const held = HOSTED ? workspaceIds.forServer(HOSTED) : null;
  held?.set(HOSTED_WORKSPACE);

  const servers = createCurrentServerStore();
  await servers.load({ load: async () => paired });
  // a stand-in for the keychain: Clerk's sign-out wipes every item the registry lists
  const keychain: { record: PairedRecord | null } = { record: paired };

  const deps: ServerSwitchDeps = {
    queryClient,
    persister: {
      ...persister,
      removeClient: async () => {
        log.push('cache');
        await persister.removeClient();
      },
    },
    workspaceIds: {
      clear: () => {
        log.push('workspace-id');
        workspaceIds.clear();
      },
    },
    provider: {
      kind: kind as Kind,
      signOut: vi.fn(async () => {
        log.push(`provider:${kind}`);
        keychain.record = null;
      }),
    },
    consent: {
      resetMemory: () => log.push('consent-memory'),
      forgetServer: async (origin: string) => {
        log.push(`consent-records:${origin}`);
      },
    },
    deviceStore: {
      save: async (record: PairedRecord) => {
        log.push('save');
        keychain.record = record;
      },
      clear: async () => {
        log.push('device-clear');
        keychain.record = null;
      },
    },
    servers: {
      getSnapshot: servers.getSnapshot,
      connected: (record: PairedRecord) => {
        log.push('current');
        servers.connected(record);
      },
      forgotten: () => {
        log.push('current');
        servers.forgotten();
      },
    },
  };
  return { log, storage, queryClient, workspaceIds, held, servers, keychain, deps };
}

describe('connectTo(record): from the hosted server to an own one', () => {
  it('clears the cache, the workspace id, Clerk and the consent memory, in that order, then pairs', async () => {
    const { log, deps } = await setup();
    await createServerSwitch(deps).connectTo(RECORD);
    expect(log).toEqual([
      'cache',
      'workspace-id',
      'provider:clerk',
      'consent-memory',
      'save',
      'current',
    ]);
  });

  it('signs out of Clerk before the record is saved: its keychain wipe never takes the pairing', async () => {
    const { keychain, servers, deps } = await setup();
    await createServerSwitch(deps).connectTo(RECORD);
    expect(keychain.record).toBe(RECORD);
    expect(servers.getSnapshot()).toEqual({
      status: 'ready',
      own: ownServerOf(RECORD),
      ended: null,
    });
  });

  it('leaves nothing of the hosted server: no query, no saved copy, no workspace id', async () => {
    const { storage, queryClient, workspaceIds, held, deps } = await setup();
    await createServerSwitch(deps).connectTo(RECORD);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(held?.get()).toBeNull();
    expect(HOSTED && workspaceIds.forServer(HOSTED).get()).toBeNull();
  });

  it("removes only the persister's own MMKV key, never the whole store", async () => {
    const { storage, deps } = await setup();
    await createServerSwitch(deps).connectTo(RECORD);
    expect(storage.getItem(NEIGHBOUR_KEY)).toBe('agreed');
  });

  it('stops with the pairing unsaved when Clerk cannot sign out (offline)', async () => {
    const { log, keychain, servers, deps } = await setup();
    const offline = {
      ...deps,
      provider: {
        kind: 'clerk' as const,
        signOut: vi.fn(async () => Promise.reject(new Error('offline'))),
      },
    };
    await expect(createServerSwitch(offline).connectTo(RECORD)).rejects.toThrow('offline');
    expect(log).toEqual(['cache', 'workspace-id']);
    expect(keychain.record).toBeNull();
    expect(servers.getSnapshot()).toEqual({ status: 'ready', own: null, ended: null });
  });
});

describe('connectTo(record): from one own server to another', () => {
  it("also removes the left server's consent records, by their own key", async () => {
    const { log, keychain, deps } = await setup({ kind: 'device', paired: RECORD });
    await createServerSwitch(deps).connectTo(OTHER_RECORD);
    expect(log).toEqual([
      'cache',
      'workspace-id',
      'provider:device',
      'consent-memory',
      `consent-records:${RECORD.origin}`,
      'save',
      'current',
    ]);
    expect(keychain.record).toBe(OTHER_RECORD);
  });
});

describe('forgetServer()', () => {
  it('clears everything of the own server in order, then the record, then moves to hosted', async () => {
    const { log, keychain, servers, deps } = await setup({ kind: 'device', paired: RECORD });
    await createServerSwitch(deps).forgetServer();
    expect(log).toEqual([
      'cache',
      'workspace-id',
      'provider:device',
      'consent-memory',
      `consent-records:${RECORD.origin}`,
      'device-clear',
      'current',
    ]);
    expect(keychain.record).toBeNull();
    expect(servers.getSnapshot()).toEqual({ status: 'ready', own: null, ended: null });
  });

  it("removes only the persister's own MMKV key here too", async () => {
    const { storage, deps } = await setup({ kind: 'device', paired: RECORD });
    await createServerSwitch(deps).forgetServer();
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NEIGHBOUR_KEY)).toBe('agreed');
  });

  it('keeps the server when the cache cannot be cleared, and says so', async () => {
    const { log, servers, deps } = await setup({ kind: 'device', paired: RECORD });
    const stuck = {
      ...deps,
      persister: { ...deps.persister, removeClient: async () => Promise.reject(new Error('disk')) },
    };
    await expect(createServerSwitch(stuck).forgetServer()).rejects.toThrow('disk');
    expect(log).toEqual([]);
    expect(servers.getSnapshot()).toEqual({
      status: 'ready',
      own: ownServerOf(RECORD),
      ended: null,
    });
  });
});
