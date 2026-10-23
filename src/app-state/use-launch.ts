// The gate's two queries, wired (the decision is gate.ts): the current server's discovery document
// (at an own server's origin, with no bearer), then, once the server takes a sign-in this app has,
// GET /api/workspaces/current. Both are persisted families, so a restored discovery document opens
// the gate at once while it refetches; the workspace is read again on every launch (staleTime 0,
// and only data fetched since this launch counts), because the server silently replaces a
// workspace header the user can no longer use; a later re-read the server refuses (paused, or no
// longer a member) takes the app away (gate.ts workspaceStepOf, US-007a). The client is rebuilt
// whenever the server or the session changes, each server with its own workspace-id holder
// (US-006d).

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { ApiClient } from '../api/client';
import { fetchDiscovery } from '../api/discovery';
import { queryKeys } from '../api/query-keys';
import type { Server } from '../api/server';
import { expoTransport } from '../api/transport';
import type { ClientAuth } from '../auth/providers/binding';
import { workspaceIds } from '../session/workspace-ids';
import {
  launchView,
  serverSupported,
  stepOf,
  workspaceStepOf,
  type LaunchStep,
  type LaunchView,
} from './gate';
import { createLaunchClient } from './launch-client';
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
  const ids = useMemo(() => workspaceIds.forServer(server), [server]);
  const client = useMemo(
    () => createLaunchClient({ server, clientAuth, workspaceIds: ids, transport: expoTransport }),
    [server, clientAuth, ids],
  );

  const discovery = useQuery({
    queryKey: queryKeys.discovery(server.apiUrl),
    queryFn: ({ signal }) => fetchDiscovery(server, { transport: expoTransport, signal }),
  });
  const discoveryStep = stepOf(discovery);

  const workspace = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: ({ signal }) => launchBootstrap(client, queryClient, { store: ids, signal }),
    enabled: serverSupported(discoveryStep, server.source),
    staleTime: WORKSPACE_STALE_TIME_MS,
  });

  const { refetch: refetchDiscovery } = discovery;
  const { refetch: refetchWorkspace } = workspace;
  const retry = useCallback(
    (step: LaunchStep) => void (step === 'discovery' ? refetchDiscovery() : refetchWorkspace()),
    [refetchDiscovery, refetchWorkspace],
  );

  const view = launchView({
    server,
    discovery: discoveryStep,
    workspace: workspaceStepOf(workspace, launchedAt),
  });
  return { view, client, retry };
}
