// The current server (current-server.ts) for components: re-rendered when it moves. The same
// snapshot on the server render, so the provider tree renders the same way in a test.

import { useSyncExternalStore } from 'react';

import { currentServers, type CurrentServerSnapshot } from './current-server';

export function useCurrentServer(): CurrentServerSnapshot {
  return useSyncExternalStore(
    currentServers.subscribe,
    currentServers.getSnapshot,
    currentServers.getSnapshot,
  );
}
