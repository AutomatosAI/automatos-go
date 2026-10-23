// The switch (switch.ts) wired to the app: its one query cache and persister, the per-server
// workspace ids, the session's active provider, the keychain's paired record and the current
// server. Screens and hooks only call forgetServer() and connectTo(record). Forget this server is
// Remove this phone first (remove-device.ts, US-006i): the server revokes this phone's row, then
// the switch forgets it here; when the server couldn't be told, a toast says Studio may still list
// the phone.

import { useMemo } from 'react';

import { expoTransport } from '../api/transport';
import { appPersister, appQueryClient } from '../app-state/query-root';
import { useAuthSession } from '../auth/AuthRoot';
import { consentMemory } from '../consent/app-store';
import { workspaceIds } from '../session/workspace-ids';
import { useToast } from '../ui';
import { currentServers } from './current-server';
import { deviceStore } from './device-store';
import { removeThisPhone } from './remove-device';
import { REMOVE_DEVICE_COPY } from './strings';
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
  const toast = useToast();
  return useMemo(() => {
    const serverSwitch = createServerSwitch({
      queryClient: appQueryClient,
      persister: appPersister(),
      workspaceIds,
      provider,
      consent: CONSENT,
      deviceStore,
      servers: currentServers,
    });
    const forgetServer = async () => {
      const result = await removeThisPhone({
        store: deviceStore,
        transport: expoTransport,
        forget: serverSwitch.forgetServer,
      });
      if (!result.removed && result.server)
        toast.show(REMOVE_DEVICE_COPY.notRemoved(result.server));
    };
    return Object.freeze({ ...serverSwitch, forgetServer });
  }, [provider, toast]);
}
