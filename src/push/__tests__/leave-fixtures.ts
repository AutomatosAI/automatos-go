// Shared fixtures of the leaving tests (US-014i): a phone holding its push record — written through
// the real key registry over a fake SecureStore, so the index lists it — with the real registrar,
// the session's leave over a client on the foundation's fake transport, the phone link that carries
// it, and the connect kit's real server switch over fakes. Every step writes to one `order` log.
// A test file that imports this mocks expo-secure-store first.

import { createQueryClient, createQueryPersister } from '../../api/query-client';
import type { AuthProvider } from '../../auth/providers/types';
import { createCurrentServerStore } from '../../connect/current-server';
import type { PairedRecord } from '../../connect/device-store';
import { createServerSwitch } from '../../connect/switch';
import { SECURE_KEY_INDEX } from '../../lib/secure-keys';
import { memoryStorage } from '../../storage/encrypted-storage';
import { revokeDevice } from '../api';
import { pushLeaveFor, type LeaveDeps } from '../bind/leave';
import { PUSH_RECORD_ITEM } from '../config';
import type { PushRecord } from '../registration/record';
import { createRegistrar } from '../registration/registrar';
import type { PushSource } from '../registration/state';
import type { PhoneLink } from '../settings/phone-link';
import type { TeardownDeps } from '../teardown';
import { WS } from './data-fixtures';
import { fakePort } from './platform-fixtures';
import { HOSTED, ORIGIN, OWN, setup, storedRecord, type Script } from './registration-fixtures';

export const SCOPE = Object.freeze({ serverOrigin: ORIGIN, workspaceId: WS });

export type PhoneOptions = Readonly<{
  source?: PushSource;
  script?: Script;
  record?: PushRecord | null;
  order?: string[];
  timeoutMs?: number;
}>;

/** The key registry's index, as the fake SecureStore holds it. */
function indexOf(items: Map<string, string>): readonly string[] {
  return JSON.parse(items.get(SECURE_KEY_INDEX) ?? '[]') as string[];
}

/** The teardown's ports over fakes, each step written to `order`. */
export function teardownOver(store: TeardownDeps['store'], order: string[]): TeardownDeps {
  const { port } = fakePort({
    setBadgeCountAsync: async (count) => (order.push(`badge:${count}`), true),
    dismissAllNotificationsAsync: async () => void order.push('dismiss'),
  });
  return {
    store,
    port,
    handled: { clear: () => void order.push('handled') },
    prompt: { clear: () => void order.push('prompt') },
  };
}

/** A phone holding its push record, its registrar, its leave and the link that carries it. */
export async function leavingPhone(options: PhoneOptions = {}) {
  const { source = 'hosted', record = storedRecord(), order = [] } = options;
  const world = setup({ script: options.script, session: source === 'own' ? OWN : HOSTED });
  if (record) await world.keys.store.save(record);
  const registrar = createRegistrar(world.deps);
  const teardown = teardownOver(world.keys.store, order);
  const deps: LeaveDeps = {
    source,
    scope: SCOPE,
    registrar,
    store: world.keys.store,
    revoke: (deviceId, signal) => revokeDevice(world.api.client, deviceId, signal),
    teardown,
    timeoutMs: options.timeoutMs,
  };
  const leave = pushLeaveFor(deps);
  const link: PhoneLink = {
    registrar,
    askPermission: async () => 'granted',
    removal: {
      deviceId: async () => null,
      remove: async () => ({ removed: false, status: { kind: 'ask' } }),
    },
    leave,
  };
  const items = world.keys.secure.items;
  return {
    world,
    registrar,
    teardown,
    deps,
    leave,
    link,
    order,
    /** The push item is still in the keychain. */
    kept: () => items.has(PUSH_RECORD_ITEM),
    /** The registry's index still names the push item. */
    listed: () => indexOf(items).includes(PUSH_RECORD_ITEM),
  };
}

/** The connect kit's real switch over fakes that write to `order`; `paired` is the own server's. */
export async function serverSwitchOver(
  order: string[],
  kind: AuthProvider['kind'],
  paired: PairedRecord | null,
) {
  const servers = createCurrentServerStore();
  await servers.load({ load: async () => paired });
  return createServerSwitch({
    queryClient: createQueryClient(),
    persister: createQueryPersister(memoryStorage()),
    workspaceIds: { clear: () => void order.push('workspace-id') },
    provider: { kind, signOut: async () => void order.push(`provider:${kind}`) },
    consent: { resetMemory: () => undefined, forgetServer: async () => undefined },
    keys: { keys: async () => [], remove: async () => undefined },
    storage: memoryStorage,
    storagePersistent: () => true,
    sessionMemory: () => undefined,
    files: () => undefined,
    deviceStore: {
      save: async () => void order.push('save'),
      clear: async () => void order.push('device-clear'),
    },
    servers,
  });
}
