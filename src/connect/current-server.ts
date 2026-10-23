// The current server (KC4, US-006d): an own server exactly when this phone holds a paired record,
// otherwise the build's built-in hosted server (env, K3). There is no other persisted choice. The
// record is read once at launch (src/auth/AuthRoot.tsx), then only three things move it: a pairing
// saved or a server forgotten (switch.ts), and a refusal of the token (the device provider's
// onRefused, US-006c), which also keeps why, so the gate can send the person to Connect with the
// reason and the server. The snapshot never holds the token: it stays in device-store.ts. No React
// and no native module here (the device store is a port), so navigation's helpers read the current
// Studio address in plain TS.

import { builtInServer, ownServerFrom, type Server } from '../api/server';
import { logger } from '../lib/logger';
import type { DeviceStore, PairedRecord } from './device-store';
import type { DeviceRefusal } from './expiry';

/** The paired server as the shell sees it: what it shows and keys on, never the token. */
export type OwnServer = {
  /** {apiUrl: the record's origin, webUrl, source 'own'} */
  readonly server: Server;
  readonly serverName: string;
  readonly edition: string;
  /** http:// on a private address: the unencrypted home network (D-HTTPS). */
  readonly insecure: boolean;
  readonly pushExpo: boolean;
  readonly deviceId: string;
  readonly workspaceId: string;
  /** This one pairing (pairingOf): a new pairing, even to the same server, is a new session. */
  readonly pairing: string;
};

export type CurrentServerSnapshot =
  | { readonly status: 'loading' }
  /** The keychain refused to say whether a server is paired: retry, never guess hosted. */
  | { readonly status: 'unreadable' }
  | {
      readonly status: 'ready';
      /** The paired own server; null means the built-in hosted server (KC4). */
      readonly own: OwnServer | null;
      /** Why the last own server ended this launch (a refusal of its token); null otherwise. */
      readonly ended: DeviceRefusal | null;
    };

export type CurrentServerStore = {
  readonly getSnapshot: () => CurrentServerSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  /** Reads the paired record, once (and again after a keychain that refused). */
  readonly load: (store: Pick<DeviceStore, 'load'>) => Promise<void>;
  /** A pairing was saved (switch.connectTo): this is the server now. */
  readonly connected: (record: PairedRecord) => void;
  /** The own server was forgotten on this phone (switch.forgetServer). */
  readonly forgotten: () => void;
  /** The server stopped accepting the token; its record is already cleared (US-006c). */
  readonly refused: (refusal: DeviceRefusal) => void;
};

/** A pairing: the device row, the server, and when this phone paired to it (US-006c). */
export function pairingOf(record: Pick<PairedRecord, 'deviceId' | 'origin' | 'pairedAt'>): string {
  return `${record.deviceId}@${record.origin}#${record.pairedAt}`;
}

export function ownServerOf(record: PairedRecord): OwnServer {
  return Object.freeze({
    server: ownServerFrom({ origin: record.origin, webUrl: record.webUrl }),
    serverName: record.serverName,
    edition: record.edition,
    insecure: record.insecure,
    pushExpo: record.pushExpo,
    deviceId: record.deviceId,
    workspaceId: record.workspaceId,
    pairing: pairingOf(record),
  });
}

const LOADING: CurrentServerSnapshot = Object.freeze({ status: 'loading' });
const UNREADABLE: CurrentServerSnapshot = Object.freeze({ status: 'unreadable' });

function ready(own: OwnServer | null, ended: DeviceRefusal | null): CurrentServerSnapshot {
  return Object.freeze({ status: 'ready', own, ended: ended && Object.freeze({ ...ended }) });
}

export function createCurrentServerStore(): CurrentServerStore {
  let snapshot = LOADING;
  let listeners: readonly (() => void)[] = [];
  let loading: Promise<void> | undefined;
  // every move bumps the generation: a read that started before one never overwrites it
  let generation = 0;

  const publish = (next: CurrentServerSnapshot) => {
    snapshot = next;
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        logger.error('[connect] a current-server listener failed', error);
      }
    }
  };
  const move = (next: CurrentServerSnapshot) => {
    generation += 1;
    publish(next);
  };

  const read = async (store: Pick<DeviceStore, 'load'>) => {
    const started = generation;
    if (snapshot.status !== 'loading') publish(LOADING);
    try {
      const record = await store.load();
      if (generation === started) publish(ready(record && ownServerOf(record), null));
    } catch (error) {
      logger.warn('[connect] the keychain did not say which server is paired', error);
      if (generation === started) publish(UNREADABLE);
    }
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    load: (store: Pick<DeviceStore, 'load'>) => {
      if (snapshot.status === 'ready') return Promise.resolve();
      loading ??= read(store).finally(() => {
        loading = undefined;
      });
      return loading;
    },
    connected: (record: PairedRecord) => move(ready(ownServerOf(record), null)),
    forgotten: () => move(ready(null, null)),
    refused: (refusal: DeviceRefusal) => move(ready(null, refusal)),
  });
}

/** The app's one current-server store. */
export const currentServers: CurrentServerStore = createCurrentServerStore();

let hosted: Server | null | undefined;

/** The built-in hosted server, read from env once (a stable object for the shell's memos). */
export function hostedServer(): Server | null {
  if (hosted === undefined) hosted = builtInServer();
  return hosted;
}

/** The paired own server, or null (none, or not read yet). */
export function ownServer(snapshot: CurrentServerSnapshot = currentServers.getSnapshot()) {
  return snapshot.status === 'ready' ? snapshot.own : null;
}

/**
 * KC4: the own server when one is paired, else the built-in hosted server; null before the record
 * is read (never a guess) and in a build with no hosted server.
 */
export function currentServer(
  snapshot: CurrentServerSnapshot = currentServers.getSnapshot(),
): Server | null {
  if (snapshot.status !== 'ready') return null;
  return snapshot.own?.server ?? hostedServer();
}

/** Studio on the web for the current server ('' when there is none to link to). */
export function currentWebUrl(): string {
  return currentServer()?.webUrl ?? '';
}
