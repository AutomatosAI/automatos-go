// The gate's two queries, wired (the decision is gate.ts): the server's discovery document, then,
// once the server takes a sign-in this app has, GET /api/workspaces/current. Both are persisted
// families, so a restored discovery document opens the gate at once while it refetches; the
// workspace is read again on every launch (staleTime 0, and only data fetched since this launch
// counts), because the server silently replaces a workspace header the user can no longer use.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { createApiClient, type ApiClient } from '../api/client';
import { fetchDiscovery } from '../api/discovery';
import { queryKeys } from '../api/query-keys';
import type { Server } from '../api/server';
import { expoTransport } from '../api/transport';
import { workspaceIdStore } from '../api/workspace';
import type { ClientAuth } from '../auth/providers/binding';
import { launchView, serverSupported, stepOf, type LaunchStep, type LaunchView } from './gate';
import { launchBootstrap } from './session-cache';

/** Every launch reads the workspace again, however recent the restored copy is. */
const WORKSPACE_STALE_TIME_MS = 0;

export type Launch = {
  readonly view: LaunchView;
  readonly client: ApiClient;
  readonly retry: (step: LaunchStep) => void;
};

export function useLaunch(server: Server, clientAuth: ClientAuth): Launch {
  const queryClient = useQueryClient();
  const [launchedAt] = useState(Date.now);
  const client = useMemo(
    () =>
      createApiClient({
        server,
        ...clientAuth,
        getWorkspaceId: workspaceIdStore.get,
        transport: expoTransport,
      }),
    [server, clientAuth],
  );

  const discovery = useQuery({
    queryKey: queryKeys.discovery(server.apiUrl),
    queryFn: ({ signal }) => fetchDiscovery(server, { transport: expoTransport, signal }),
  });
  const discoveryStep = stepOf(discovery);

  const workspace = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: ({ signal }) => launchBootstrap(client, queryClient, { signal }),
    enabled: serverSupported(discoveryStep),
    staleTime: WORKSPACE_STALE_TIME_MS,
  });

  const { refetch: refetchDiscovery } = discovery;
  const { refetch: refetchWorkspace } = workspace;
  const retry = useCallback(
    (step: LaunchStep) => void (step === 'discovery' ? refetchDiscovery() : refetchWorkspace()),
    [refetchDiscovery, refetchWorkspace],
  );

  const view = launchView({ discovery: discoveryStep, workspace: stepOf(workspace, launchedAt) });
  return { view, client, retry };
}
