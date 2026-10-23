// The signed-in session's one API client (D-ONE-CLIENT): the current server, the session's bearer
// and its 401 binding, and THIS server's X-Workspace-ID holder (src/session/workspace-ids.ts), so
// a client never sends another server's workspace id (US-006d). use-launch.ts builds it over the
// real transport; tests build it over a fake one.

import { createApiClient, type ApiClient } from '../api/client';
import type { Server } from '../api/server';
import type { Transport } from '../api/transport-types';
import type { WorkspaceIdStore } from '../api/workspace';
import type { ClientAuth } from '../auth/providers/binding';

export type LaunchClientInput = {
  readonly server: Server;
  readonly clientAuth: ClientAuth;
  /** The holder workspace-ids.ts hands out for this server. */
  readonly workspaceIds: Pick<WorkspaceIdStore, 'get'>;
  readonly transport: Transport;
};

export function createLaunchClient({
  server,
  clientAuth,
  workspaceIds,
  transport,
}: LaunchClientInput): ApiClient {
  return createApiClient({ server, ...clientAuth, getWorkspaceId: workspaceIds.get, transport });
}
