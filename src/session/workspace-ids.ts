// One X-Workspace-ID holder per server (US-006d: one server's workspace id is never sent to
// another). The foundation's bootstrap writes the id its client was given (src/api/workspace.ts
// bootstrapWorkspace's store); the shell hands each server's client and bootstrap the holder of
// THAT server, a fresh one whenever the server changes. A bootstrap of the last server that lands
// after a switch writes only its own, orphaned holder, so the next server's first calls send no
// workspace header (the device lane then uses the device's own workspace) and never the last one's.
// clear() is "forget the stored X-Workspace-ID": the switch and a sign-out call it.

import type { Server } from '../api/server';
import { createWorkspaceIdStore, type WorkspaceIdStore } from '../api/workspace';

export type WorkspaceIdRegistry = {
  /** The holder for this server: the same one until the server changes or clear() runs. */
  readonly forServer: (server: Server) => WorkspaceIdStore;
  /** Forgets the held id, and the holder with it: the next forServer starts empty. */
  readonly clear: () => void;
};

function serverKey(server: Server): string {
  return `${server.source}|${server.apiUrl}`;
}

export function createWorkspaceIdRegistry(): WorkspaceIdRegistry {
  let held: { readonly key: string; readonly store: WorkspaceIdStore } | null = null;
  return Object.freeze({
    forServer: (server: Server) => {
      const key = serverKey(server);
      if (held?.key !== key) {
        held?.store.clear();
        held = Object.freeze({ key, store: createWorkspaceIdStore() });
      }
      return held.store;
    },
    clear: () => {
      held?.store.clear();
      held = null;
    },
  });
}

/** The app's one registry (use-launch.ts, the switch, the sign-out clean-up). */
export const workspaceIds: WorkspaceIdRegistry = createWorkspaceIdRegistry();
