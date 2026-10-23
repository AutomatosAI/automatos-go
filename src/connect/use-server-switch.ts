// The switch (switch.ts) wired to the app: its one query cache and persister, the per-server
// workspace ids, the session's active provider, the keychain's paired record and the current
// server. Screens and hooks only call forgetServer() and connectTo(record).

import { useMemo } from 'react';

import { appPersister, appQueryClient } from '../app-state/query-root';
import { useAuthSession } from '../auth/AuthRoot';
import { consentMemory } from '../consent/app-store';
import { workspaceIds } from '../session/workspace-ids';
import { currentServers } from './current-server';
import { deviceStore } from './device-store';
import { createServerSwitch, type ConsentPort, type ServerSwitch } from './switch';

/**
 * The consent step's memory is dropped, and the consent records of a server left behind go with it,
 * from the store and then from memory (US-007b, US-007c: src/consent/memory.ts).
 */
const CONSENT: ConsentPort = Object.freeze({
  resetMemory: () => consentMemory.resetMemory(),
  forgetServer: (origin: string) => consentMemory.forgetServer(origin),
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
