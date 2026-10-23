// The paired-phone sign-in provider (D-AUTH-PROVIDER, US-006): a self-hosted install's device token
// behind the same small interface as Clerk, an added file and one registry entry (KC15: the
// interface gains no method). getToken reads the paired record (src/connect/device-store.ts: memory
// first, then the keychain); signOut forgets it on this phone (Remove this phone, the server side,
// runs before it: src/connect/remove-device.ts); onExpired hears that the server stopped accepting
// the token.
//
// A provider serves ONE pairing, the first record it reads: its server, its device row and the
// moment it paired (the server keeps the row when a phone pairs again, so the row alone is not
// enough). A token rotation (src/connect/rotation.ts) keeps all three and changes only the token
// and rotateAfter, so the provider goes on serving the pairing and hands out the new token once the
// store holds it (the store shows a record only after its keychain write). Once the phone pairs
// again, here or elsewhere, it gives no token, so a call still running for the last pairing never
// carries the next one's token, and the shell builds a new provider for the new pairing.
//
// The client's 401s reach the provider through its refusal source, each with its ApiError: bound
// with bindProvider (binding.ts) a 401 would reach only the listeners, without its code and before
// anything is cleared, so a paired phone binds through bindDeviceProvider below. A 401 ends the
// pairing once its token has gone out on a call (a 401 to a call made with no token says nothing
// about it): the record is cleared, the refusal kept with the server's name (revoked, pairing
// required or ended: src/connect/expiry.ts) and the listeners hear it ONCE, however many calls
// fail together.

import { pairingOf } from '../../connect/current-server';
import type { DeviceStore, PairedRecord } from '../../connect/device-store';
import { classifyDeviceRefusal, type DeviceRefusal } from '../../connect/expiry';
import { logger } from '../../lib/logger';
import type { ProviderBinding } from './binding';
import { createExpirySignal, type ExpirySignal } from './expiry';
import type { AuthProvider } from './types';

type RefusalListener = (error?: unknown) => void;

/** The API client's 401s (src/api/client.ts onAuthExpired), each with its ApiError. */
export type RefusalSource = {
  readonly subscribe: (listener: RefusalListener) => () => void;
};

export type DeviceProviderDeps = {
  readonly store: DeviceStore;
  /** onExpired's listeners: they hear a refusal once its record is cleared. */
  readonly expiry: ExpirySignal;
  /** The client's 401s, heard by the provider before anyone else. */
  readonly refusals: RefusalSource;
  /** Hears the refusal before the listeners do (the gate shows it on Connect, US-006d). */
  readonly onRefused?: (refusal: DeviceRefusal) => void;
};

/** A refusal source and the call that feeds it (the client's onAuthExpired). */
export function createRefusalSource(): RefusalSource & { readonly notify: RefusalListener } {
  let listeners: readonly RefusalListener[] = [];
  return Object.freeze({
    subscribe: (listener: RefusalListener) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    notify: (error?: unknown) => {
      for (const listener of listeners) {
        try {
          listener(error);
        } catch (failure) {
          logger.error('[auth] a device refusal listener failed', failure);
        }
      }
    },
  });
}

function report(onRefused: DeviceProviderDeps['onRefused'], refusal: DeviceRefusal): void {
  try {
    onRefused?.(refusal);
  } catch (error) {
    logger.error('[auth] the device refusal listener failed', error);
  }
}

/** The provider's one pairing: the first record it reads, and whether its token has gone out. */
type OwnPairing = {
  /** The current record if it is this provider's pairing. */
  readonly record: () => Promise<PairedRecord | null>;
  /** Its token, for a call: from then on a 401 is about that token. */
  readonly token: () => Promise<string | null>;
  readonly served: () => boolean;
};

function ownPairing(store: DeviceStore): OwnPairing {
  let pairing: string | undefined;
  let served = false;
  const record = async (): Promise<PairedRecord | null> => {
    const current = await store.load();
    if (!current) return null;
    pairing ??= pairingOf(current);
    return pairingOf(current) === pairing ? current : null;
  };
  return Object.freeze({
    record,
    token: async () => {
      const current = await record();
      if (!current) return null;
      served = true;
      return current.token;
    },
    served: () => served,
  });
}

async function endPairing(
  own: OwnPairing,
  { store, expiry, onRefused }: DeviceProviderDeps,
  error: unknown,
): Promise<void> {
  const record = await own.record();
  // already ended, paired again since, or its token never went out on a call
  if (!record || !own.served()) return;
  const reason = classifyDeviceRefusal(error);
  try {
    await store.clear();
  } catch (clearError) {
    // the store forgot it in memory: no call this launch sends the refused token again
    logger.warn('[auth] could not delete a refused pairing from the keychain', clearError);
  }
  report(onRefused, { reason, serverName: record.serverName, origin: record.origin });
  expiry.notify();
}

/** Ends the pairing on the client's 401s: one at a time, so concurrent ones end it once. */
function endOnRefusal(own: OwnPairing, deps: DeviceProviderDeps): void {
  let ending: Promise<void> | undefined;
  deps.refusals.subscribe((error) => {
    ending ??= endPairing(own, deps, error)
      .catch((failure: unknown) => logger.warn('[auth] could not end a refused pairing', failure))
      .finally(() => {
        ending = undefined;
      });
  });
}

export function createDeviceProvider(deps: DeviceProviderDeps): AuthProvider {
  const own = ownPairing(deps.store);
  endOnRefusal(own, deps);
  return Object.freeze({
    kind: 'device' as const,
    getToken: own.token,
    signOut: async () => {
      if (await own.record()) await deps.store.clear();
    },
    onExpired: deps.expiry.subscribe,
  });
}

/** The device provider over fresh signals, with the client options bound to both. */
export function bindDeviceProvider(
  deps: Omit<DeviceProviderDeps, 'expiry' | 'refusals'>,
): ProviderBinding {
  const refusals = createRefusalSource();
  const provider = createDeviceProvider({ ...deps, expiry: createExpirySignal(), refusals });
  return Object.freeze({
    provider,
    clientAuth: Object.freeze({
      getToken: () => provider.getToken(),
      onAuthExpired: refusals.notify,
    }),
  });
}
