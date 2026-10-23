// The switch (switch.ts) wired to the app: its one query cache and persister, the per-server
// workspace ids, the session's active provider, the keychain's paired record and the current
// server. Screens and hooks only call forgetServer() and connectTo(record).

import { useMemo } from 'react';

import { appPersister, appQueryClient } from '../app-state/query-root';
import { useAuthSession } from '../auth/AuthRoot';
import { consentStore } from '../consent/app-store';
import { workspaceIds } from '../session/workspace-ids';
import { currentServers } from './current-server';
import { deviceStore } from './device-store';
import { createServerSwitch, type ConsentPort, type ServerSwitch } from './switch';

/**
 * The consent records of a server left behind go with it (US-007b). The gate's consent step
 * (US-007c) holds nothing in memory yet; it replaces resetMemory with its own.
 */
const CONSENT: ConsentPort = Object.freeze({
  resetMemory: () => undefined,
  forgetServer: (origin: string) => consentStore.forgetServer(origin),
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
        consent: CONSENT,
        deviceStore,
        servers: currentServers,
      }),
    [provider],
  );
}
