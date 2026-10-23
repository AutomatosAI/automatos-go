// What the shell does to the query cache around a session (D-CACHE, D-ONE-CLIENT). On launch the
// workspace query seeds the X-Workspace-ID store from the copy restored from the phone, so a user in
// several workspaces stays in the one they were in, then reads GET /api/workspaces/current; if the
// server resolved another workspace, everything cached for the old one is dropped before the new id
// is stored. Signed out (Sign out, an expired session, or one ended elsewhere), the phone forgets
// the workspace id and every cached query, in memory and on disk. Each server's client and
// bootstrap get that server's own workspace-id holder (src/session/workspace-ids.ts, US-006d).
// Pure over its ports; AppGate wires the app's QueryClient and persister.

import type { Query, QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import { z } from 'zod';

import type { ApiClient } from '../api/client';
import { clearQueryCache } from '../api/query-client';
import { matchesFamily, queryKeys, type KeyFamilyName } from '../api/query-keys';
import { workspaceIds } from '../session/workspace-ids';
import {
  bootstrapWorkspace,
  workspaceIdStore,
  type Workspace,
  type WorkspaceIdStore,
} from '../api/workspace';

/**
 * Families that outlive a change of workspace: the server's own discovery document, and the
 * workspace query itself (it is the call in flight when the change is found, and it is about to
 * hold the new workspace).
 */
const KEPT_ON_WORKSPACE_CHANGE: readonly KeyFamilyName[] = Object.freeze([
  'discovery',
  'workspace',
]);

function belongsToWorkspace(query: Query): boolean {
  return !KEPT_ON_WORKSPACE_CHANGE.some((name) => matchesFamily(name, query.queryKey));
}

/**
 * Drops every query of the old workspace (board, questions, chats, Deliverables, …). The persist
 * subscription hears the removals and saves the smaller cache, so the old workspace's lists are
 * gone from the phone too. The gate then mounts every screen afresh under the new workspace
 * (AppGate.tsx keys them by its id), so no screen keeps the old one's local state either.
 */
export async function forgetWorkspaceData(queryClient: QueryClient): Promise<void> {
  const filters = { predicate: belongsToWorkspace };
  await queryClient.cancelQueries(filters);
  queryClient.removeQueries(filters);
}

/** Only the id is read from the restored copy, and it is file content: parsed, never trusted. */
const RestoredWorkspaceSchema = z.object({ id: z.string().uuid() });

/** Seeds an empty store with the restored workspace's id; a held id or an unreadable copy wins. */
export function seedWorkspaceId(store: WorkspaceIdStore, restored: unknown): void {
  if (store.get() !== null) return;
  const parsed = RestoredWorkspaceSchema.safeParse(restored);
  if (parsed.success) store.set(parsed.data.id);
}

export type LaunchBootstrapOptions = {
  readonly store?: WorkspaceIdStore;
  readonly signal?: AbortSignal;
};

/** The gate's workspace query function (queryKeys.workspace()). */
export function launchBootstrap(
  client: ApiClient,
  queryClient: QueryClient,
  { store = workspaceIdStore, signal }: LaunchBootstrapOptions = {},
): Promise<Workspace> {
  seedWorkspaceId(store, queryClient.getQueryData(queryKeys.workspace()));
  return bootstrapWorkspace(client, {
    store,
    signal,
    onWorkspaceChange: () => forgetWorkspaceData(queryClient),
  });
}

/** Signed out: the next person to sign in on this phone starts from nothing. */
export async function forgetSession(
  queryClient: QueryClient,
  persister: Persister,
  ids: Pick<WorkspaceIdStore, 'clear'> = workspaceIds,
): Promise<void> {
  ids.clear();
  await clearQueryCache(queryClient, persister);
}
