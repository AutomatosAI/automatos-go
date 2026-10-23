// The consent step's memory (US-007c, KC11): the records the gate and the sheet read, held after
// the first read so both re-render on one snapshot (useSyncExternalStore needs the same object
// until it changes). 'Agree and continue' writes the record to the store, then holds it; a write
// the phone refuses still holds it for this run (the person did agree), and the next launch asks
// again. The switch (src/connect/switch.ts) drops it: resetMemory forgets every held record, and
// forgetServer removes a server's records from the store and then from here, so no listener can
// read a left server's agreement back between the two. Pure over its store; app-store.ts wires
// the app's.

import { logger } from '../lib/logger';
import type { ConsentRecord, ConsentScope, ConsentStore } from './store';

export type ConsentMemory = {
  readonly subscribe: (listener: () => void) => () => void;
  /** This scope's record: the store's, read once and then held. Never throws. */
  readonly read: (scope: ConsentScope) => ConsentRecord | null;
  /** 'Agree and continue': writes the record, then holds it (held even when the write fails). */
  readonly agree: (scope: ConsentScope, record: ConsentRecord) => void;
  /** Forgets every held record (the switch, before the next server is used). */
  readonly resetMemory: () => void;
  /** Removes a server's records from the store, then from memory. Never throws. */
  readonly forgetServer: (origin: string) => Promise<void>;
};

export type ConsentMemoryDeps = {
  readonly store: ConsentStore;
};

/** A held read: whose it is (the server, for forgetServer) and the record, or none. */
type Entry = { readonly origin: string; readonly record: ConsentRecord | null };
type Held = ReadonlyMap<string, Entry>;

/** One key per scope; JSON, so no origin can run into a workspace id. */
function heldKey({ origin, workspaceId }: ConsentScope): string {
  return JSON.stringify([origin, workspaceId]);
}

function withoutOrigin(held: Held, origin: string): Held {
  return new Map([...held].filter(([, entry]) => entry.origin !== origin));
}

export function createConsentMemory({ store }: ConsentMemoryDeps): ConsentMemory {
  let held: Held = new Map();
  let listeners: readonly (() => void)[] = [];

  const publish = (next: Held) => {
    held = next;
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        logger.error('[consent] a consent listener failed', error);
      }
    }
  };
  const hold = (scope: ConsentScope, record: ConsentRecord | null): Held =>
    new Map([...held, [heldKey(scope), Object.freeze({ origin: scope.origin, record })]]);

  return Object.freeze({
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    read: (scope: ConsentScope) => {
      const entry = held.get(heldKey(scope));
      if (entry) return entry.record;
      const record = store.read(scope);
      // a read is no change: held without telling the listeners (one may be reading right now)
      held = hold(scope, record);
      return record;
    },
    agree: (scope: ConsentScope, record: ConsentRecord) => {
      try {
        store.write(scope, record);
      } catch (error) {
        logger.warn('[consent] the agreement could not be saved; asking again next launch', error);
      }
      publish(hold(scope, record));
    },
    resetMemory: () => publish(new Map()),
    forgetServer: async (origin: string) => {
      await store.forgetServer(origin);
      publish(withoutOrigin(held, origin));
    },
  });
}
