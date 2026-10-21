// The signed-in session every screen under the gate reads (K5): the server, its discovery document,
// the workspace this launch's bootstrap returned (id, name, role) and the one API client bound to
// the sign-in provider and the workspace id. Only under AppGate, once the gate is ready, so a screen
// never sees a half-launched session. The sign-in provider itself is useAuthSession()'s.

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { ApiClient } from '../api/client';
import type { Discovery } from '../api/discovery';
import type { Server } from '../api/server';
import type { Workspace } from '../api/workspace';

export type AppSession = {
  readonly server: Server;
  readonly discovery: Discovery;
  readonly workspace: Workspace;
  readonly client: ApiClient;
};

const AppSessionContext = createContext<AppSession | null>(null);

export type AppSessionProviderProps = AppSession & { readonly children: ReactNode };

export function AppSessionProvider({
  server,
  discovery,
  workspace,
  client,
  children,
}: AppSessionProviderProps) {
  const value = useMemo<AppSession>(
    () => ({ server, discovery, workspace, client }),
    [server, discovery, workspace, client],
  );
  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

/** The ready session; only on screens under the (app) gate. */
export function useAppSession(): AppSession {
  const session = useContext(AppSessionContext);
  if (!session) throw new Error('useAppSession must be used under the (app) gate');
  return session;
}

/** The one API client (D-ONE-CLIENT): every screen's calls go through it. */
export function useApiClient(): ApiClient {
  return useAppSession().client;
}
