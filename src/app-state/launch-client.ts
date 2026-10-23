// The signed-in session's one API client (D-ONE-CLIENT): the current server, the session's bearer
// and its 401 binding, and THIS server's X-Workspace-ID holder (src/session/workspace-ids.ts), so
// a client never sends another server's workspace id (US-006d). It reports every 403 it sees to
// the session's refusal channel (src/session/refusals.ts) before the caller gets the same ApiError,
// whichever kit made the call (a chat turn, a card's Approve, an upload, a Command Centre write),
// so the role is read again even for calls the TanStack caches never see (US-007a,
// P001N-SEAM-1). The workspace read's own refusal is not reported: it IS the read, and the gate
// shows it, so it can never loop. use-launch.ts builds it over the real transport; tests build it
// over a fake one.

import { createApiClient, type ApiClient, type CallOptions } from '../api/client';
import { routes, type Route } from '../api/routes';
import type { Server } from '../api/server';
import type { Transport } from '../api/transport-types';
import type { WorkspaceIdStore } from '../api/workspace';
import type { ClientAuth } from '../auth/providers/binding';
import { sessionRefusals, type Refusals } from '../session/refusals';
import { isForbidden } from '../session/role-refresh';

export type LaunchClientInput = {
  readonly server: Server;
  readonly clientAuth: ClientAuth;
  /** The holder workspace-ids.ts hands out for this server. */
  readonly workspaceIds: Pick<WorkspaceIdStore, 'get'>;
  readonly transport: Transport;
  /** Where its 403s are reported: the session's channel unless a test hands its own. */
  readonly refusals?: Pick<Refusals, 'report'>;
};

const isWorkspaceRead = (route: Route): boolean =>
  route.method === routes.workspaceCurrent.method && route.path === routes.workspaceCurrent.path;

/** The same client, telling `refusals` of each 403 but the workspace read's, then rethrowing it. */
function reportingRefusals(client: ApiClient, refusals: Pick<Refusals, 'report'>): ApiClient {
  const reported = async <T>(route: Route, call: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (error) {
      if (isForbidden(error) && !isWorkspaceRead(route)) refusals.report(error);
      throw error;
    }
  };
  return Object.freeze({
    server: client.server,
    request: ((route: Route, call?: CallOptions) =>
      reported(route, () => client.request(route, call))) as ApiClient['request'],
    stream: (route: Route, call?: CallOptions) => reported(route, () => client.stream(route, call)),
    authHeaders: client.authHeaders,
  });
}

export function createLaunchClient({
  server,
  clientAuth,
  workspaceIds,
  transport,
  refusals = sessionRefusals,
}: LaunchClientInput): ApiClient {
  const client = createApiClient({
    server,
    ...clientAuth,
    getWorkspaceId: workspaceIds.get,
    transport,
  });
  return reportingRefusals(client, refusals);
}
