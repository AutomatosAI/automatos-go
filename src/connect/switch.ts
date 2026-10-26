// Switching servers (US-006d, PRD-001 §4.5): nothing from one server ever reaches another. Before
// the next server is used, forgetServer() and connectTo(record) clear, in this order: the query
// cache and its persisted copy (the foundation's clearQueryCache, whose persister removes only its
// own MMKV key, never the whole store: the install marker and the consent records live beside
// it), the stored X-Workspace-ID, the active provider and the consent step's in-memory state.
//
// The active provider is signed out: Clerk's signOut also wipes every keychain item the registry
// lists (src/auth/providers/clerk.ts), so connectTo saves the new paired record only AFTER it,
// and a provider that cannot sign out (Clerk offline) stops the switch with the pairing unsaved
// (connectTo rejects; the caller still holds the record and may try again). The current server
// moves last (current-server.ts), which remounts the provider tree on the new server
// (src/auth/AuthRoot.tsx). Pure over its ports; use-server-switch.ts wires the app's.

import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { clearQueryCache } from '../api/query-client';
import type { AuthProvider } from '../auth/providers/types';
import { clearPushBeforeLeaving } from '../push/bind/before-leaving';
import type { WorkspaceIdRegistry } from '../session/workspace-ids';
import { ownServer, type CurrentServerStore } from './current-server';
import type { DeviceStore, PairedRecord } from './device-store';

/** The consent step's state (US-007b records, US-007c the gate step). */
export type ConsentPort = {
  /** Drops what the consent step holds in memory. */
  readonly resetMemory: () => void;
  /** Removes the consent records kept for a server (its one key, src/consent/store.ts). */
  readonly forgetServer: (origin: string) => Promise<void>;
};

export type ServerSwitchDeps = {
  readonly queryClient: QueryClient;
  readonly persister: Persister;
  readonly workspaceIds: Pick<WorkspaceIdRegistry, 'clear'>;
  /** The provider of the session being left: Clerk, or this phone's pairing. */
  readonly provider: Pick<AuthProvider, 'kind' | 'signOut'>;
  readonly consent: ConsentPort;
  readonly deviceStore: Pick<DeviceStore, 'save' | 'clear'>;
  readonly servers: Pick<CurrentServerStore, 'getSnapshot' | 'connected' | 'forgotten'>;
};

export type ServerSwitch = {
  /** Forget this server: this phone stops using its own server (Studio still lists it, US-006h). */
  readonly forgetServer: () => Promise<void>;
  /** Use this newly paired server: everything of the last one is cleared, then the record saved. */
  readonly connectTo: (record: PairedRecord) => Promise<void>;
};

/** The four clearings, in the order the contract names; the provider's failure stops them. */
async function clearSession(deps: ServerSwitchDeps, leftOrigin: string | null): Promise<void> {
  // push first (US-014i): the session's leave runs teardownLocal, after the hosted row's DELETE,
  // which still needs the session's token and workspace id
  await clearPushBeforeLeaving();
  await clearQueryCache(deps.queryClient, deps.persister);
  deps.workspaceIds.clear();
  await deps.provider.signOut();
  deps.consent.resetMemory();
  if (leftOrigin !== null) await deps.consent.forgetServer(leftOrigin);
}

/** The own server being left, if any (its consent records go with it). */
function leftOwnOrigin(deps: ServerSwitchDeps): string | null {
  return ownServer(deps.servers.getSnapshot())?.server.apiUrl ?? null;
}

export function createServerSwitch(deps: ServerSwitchDeps): ServerSwitch {
  return Object.freeze({
    forgetServer: async () => {
      await clearSession(deps, leftOwnOrigin(deps));
      // the provider forgot its own pairing; this forgets whatever record is there
      await deps.deviceStore.clear();
      deps.servers.forgotten();
    },
    connectTo: async (record: PairedRecord) => {
      await clearSession(deps, leftOwnOrigin(deps));
      await deps.deviceStore.save(record);
      deps.servers.connected(record);
    },
  });
}
