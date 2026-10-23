// The switch (switch.ts) wired to the app: its one query cache and persister, the per-server
// workspace ids, the session's active provider, the keychain's paired record and the current
// server. Screens and hooks only call forgetServer() and connectTo(record).

import { useMemo } from 'react';

import { appPersister, appQueryClient } from '../app-state/query-root';
import { useAuthSession } from '../auth/AuthRoot';
import { workspaceIds } from '../session/workspace-ids';
import { currentServers } from './current-server';
import { deviceStore } from './device-store';
import { createServerSwitch, type ConsentPort, type ServerSwitch } from './switch';

/**
 * The consent step does not exist yet: US-007b (its records, kept per server origin) and US-007c
 * (the gate's step) replace this with theirs. Until then there is nothing of it to clear.
 */
const CONSENT_NOT_BUILT: ConsentPort = Object.freeze({
  resetMemory: () => undefined,
  forgetServer: async () => undefined,
});

export function useServerSwitch(): ServerSwitch {
  const { provider } = useAuthSession();
  return useMemo(
    () =>
      createServerSwitch({
        queryClient: appQueryClient,
        persister: appPersister(),
        workspaceIds,
        provider,
        consent: CONSENT_NOT_BUILT,
        deviceStore,
        servers: currentServers,
      }),
    [provider],
  );
}
