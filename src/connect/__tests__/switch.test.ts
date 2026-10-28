// Switching servers (US-006d): forgetServer() and connectTo(record) clear the query cache and its
// persisted copy, the stored X-Workspace-ID, the active provider and the consent step's memory, in
// that order, then (release KR9, clearUserData) every entry of the encrypted store but the phone's
// own choices and the person's keychain items, before the next server is used. Over the real
// QueryClient, persister, workspace-id registry and a memory store; the provider, consent and
// keychain are fakes. src/release/__tests__/user-data.test.ts runs the same over the real registry.

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
import { consentKeyFor, createConsentStore, type ConsentRecord } from '../../consent/store';
import { createWorkspaceIdRegistry } from '../../session/workspace-ids';
import { memoryStorage } from '../../storage/encrypted-storage';
import { STYLE_CHOICE_KEY } from '../../styles/registry/choice-store';
import { THEME_CHOICE_STORAGE_KEY } from '../../styles/theme-choice';
import { digestNowView } from '../../push/settings/digest-now';
import { createDigestNowStore } from '../../push/settings/digest-now-store';
import { createCurrentServerStore, ownServerOf } from '../current-server';
import type { PairedRecord } from '../device-store';
import { createServerSwitch, type ServerSwitchDeps } from '../switch';
import { OTHER_RECORD, RECORD } from './paired-record';

const HOSTED = hostedServerFrom({ apiUrl: 'https://api.example.test', webUrl: '' });
const HOSTED_WORKSPACE = '11111111-1111-4111-8111-111111111111';
/** Another MMKV item of the app's store beside the cache (a server's consent records, US-007b). */
const NEIGHBOUR_KEY = consentKeyFor('https://neighbour.example.test');

const AGREED: ConsentRecord = Object.freeze({
  fingerprint: '1|unlisted',
  providerNames: [],
  agreedAt: '2026-10-23T09:00:00.000Z',
  copyVersion: 1,
});

type Kind = AuthProvider['kind'];

/** The app's ports over fakes that write what they did, in order, to one log. */
async function setup({ kind = 'clerk', paired = null as PairedRecord | null } = {}) {
  const log: string[] = [];
  const storage = memoryStorage();
  storage.setItem(NEIGHBOUR_KEY, 'agreed');
  // the phone's own choices (switch.ts PHONE_CHOICES)
  storage.setItem(THEME_CHOICE_STORAGE_KEY, 'dark');
  storage.setItem(STYLE_CHOICE_KEY, 'play');
  const persister = createQueryPersister(storage);
  const queryClient = createQueryClient();
  queryClient.setQueryData(queryKeys.workspace(), { id: HOSTED_WORKSPACE });
  queryClient.setQueryData(queryKeys.board(), [{ id: 1 }]);
  await persistQueryClientSave({ queryClient, ...persistOptions(persister, 'device-1') });

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
    storage: () => {
      log.push('store');
      return storage;
    },
    storagePersistent: () => true,
    sessionMemory: () => undefined,
    files: () => log.push('files'),
    keys: {
      keys: async () => {
        log.push('user-keys');
        return [];
      },
      remove: async () => undefined,
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
      'store',
      'files',
      'user-keys',
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

  it("empties the store but the phone's own choices: no server's consent record stays", async () => {
    const { storage, deps } = await setup();
    await createServerSwitch(deps).connectTo(RECORD);
    expect(storage.getItem(NEIGHBOUR_KEY)).toBeNull();
    expect(storage.keys()).toEqual([THEME_CHOICE_STORAGE_KEY, STYLE_CHOICE_KEY]);
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
  it("also removes the left server's consent records, under that server's one key", async () => {
    const { log, keychain, deps } = await setup({ kind: 'device', paired: RECORD });
    await createServerSwitch(deps).connectTo(OTHER_RECORD);
    expect(log).toEqual([
      'cache',
      'workspace-id',
      'provider:device',
      'consent-memory',
      `consent-records:${RECORD.origin}`,
      'store',
      'files',
      'user-keys',
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
      'store',
      'files',
      'user-keys',
      'device-clear',
      'current',
    ]);
    expect(keychain.record).toBeNull();
    expect(servers.getSnapshot()).toEqual({ status: 'ready', own: null, ended: null });
  });

  it("empties the store here too: the cache and every entry but the phone's own choices", async () => {
    const { storage, deps } = await setup({ kind: 'device', paired: RECORD });
    await createServerSwitch(deps).forgetServer();
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NEIGHBOUR_KEY)).toBeNull();
    expect(storage.keys()).toEqual([THEME_CHOICE_STORAGE_KEY, STYLE_CHOICE_KEY]);
  });

  it("over the consent store: the forgotten server's records go, and the hosted server's (the person's)", async () => {
    const { storage, deps } = await setup({ kind: 'device', paired: RECORD });
    const consent = createConsentStore({ storage: () => storage });
    const own = { origin: RECORD.origin, workspaceId: RECORD.workspaceId };
    const hosted = { origin: HOSTED?.apiUrl ?? '', workspaceId: HOSTED_WORKSPACE };
    consent.write(own, AGREED);
    consent.write(hosted, AGREED);
    const port = { resetMemory: () => undefined, forgetServer: consent.forgetServer };
    await createServerSwitch({ ...deps, consent: port }).forgetServer();
    expect(consent.read(own)).toBeNull();
    expect(storage.getItem(consentKeyFor(RECORD.origin))).toBeNull();
    expect(consent.read(hosted)).toBeNull();
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

describe("the session's memory: today's brief's wait never reaches the next person", () => {
  const T0 = 1_792_540_800_000;

  /** Account A sent today's brief (a 202): the button waits 5 minutes. */
  async function sentOnA() {
    const digest = createDigestNowStore(() => T0);
    await digest.press(async () => undefined);
    expect(digestNowView(digest.current(), T0).disabled).toBe(true);
    return digest;
  }

  it.each([
    ['Sign out (hosted)', 'clerk', null],
    ['Forget this server', 'device', RECORD],
    ['an ended session', 'clerk', null],
  ] as const)('%s clears it: B signs in to an enabled button', async (way, kind, paired) => {
    const { log, deps } = await setup({ kind, paired });
    const digest = await sentOnA();
    const serverSwitch = createServerSwitch({
      ...deps,
      sessionMemory: () => {
        log.push('session-memory');
        digest.reset();
      },
    });
    if (way === 'Forget this server') await serverSwitch.forgetServer();
    else if (way === 'an ended session') await serverSwitch.endSession();
    else await serverSwitch.signOut();
    expect(log.indexOf('session-memory')).toBe(log.indexOf('consent-memory') + 1);
    expect(digestNowView(digest.current(), T0)).toMatchObject({ disabled: false, line: null });
    const send = vi.fn(async () => undefined);
    await expect(digest.press(send)).resolves.toEqual({ kind: 'queued' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('switching account to another server (a new pairing) clears it too', async () => {
    const { deps } = await setup();
    const digest = await sentOnA();
    await createServerSwitch({ ...deps, sessionMemory: digest.reset }).connectTo(RECORD);
    expect(digest.current()).toEqual({ sending: false, waitUntil: null, refusal: null });
  });

  it('stays while the provider cannot sign out (the person is still signed in)', async () => {
    const { deps } = await setup();
    const digest = await sentOnA();
    const offline = {
      ...deps,
      sessionMemory: digest.reset,
      provider: {
        kind: 'clerk' as const,
        signOut: vi.fn(async () => Promise.reject(new Error('offline'))),
      },
    };
    await expect(createServerSwitch(offline).signOut()).rejects.toThrow('offline');
    expect(digestNowView(digest.current(), T0).disabled).toBe(true);
  });
});
