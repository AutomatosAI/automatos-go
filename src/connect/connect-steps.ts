// The connect flow's two calls (flow.ts), over ports: discovery at the origin being checked, and
// the pairing the person confirmed. Each resolves with the action that feeds its answer back to the
// step machine and never rejects. A pairing is `paired` only once POST /pair answered AND
// switch.connectTo saved the record and moved the current server (KC8, US-006c, US-006d): nothing
// else is persisted here. The token goes from POST /pair's answer into the record handed to
// connectTo and nowhere else; the action carries the record without it (KC9). use-connect.ts wires
// the app's ports; tests pass fakes.

import { fetchDiscovery } from '../api/discovery';
import { isAbortError } from '../api/errors';
import type { Server } from '../api/server';
import type { Transport } from '../api/transport-types';
import { logger } from '../lib/logger';
import { pairDevice } from './api';
import { pairedRecordFrom, withoutToken, type ConfirmDetails } from './confirm';
import type { DevicePlatform } from './device-info';
import type { PairedRecord } from './device-store';
import type { ConnectAction, PairFailure } from './flow';
import { discoveryFailureFor, discoveryServerFor, nextStepFor } from './next-step';

/** This phone as POST /pair names it (device-info.ts). */
export type PairingDevice = {
  readonly name: string;
  readonly platform: DevicePlatform;
  readonly appVersion?: string;
};

export type ConnectPorts = {
  readonly transport: Transport;
  /** The build's built-in hosted server (K3), or null in a build with none. */
  readonly hosted: Server | null;
  /** This install's id (install-id.ts); a keychain failure rejects. */
  readonly installId: () => Promise<string>;
  readonly device: PairingDevice;
  /** switch.connectTo: clears the last server's session, saves the record, moves the server. */
  readonly connectTo: (record: PairedRecord) => Promise<void>;
  /** This phone's clock, for the record's pairedAt. */
  readonly now: () => Date;
};

type DiscoveryPorts = Pick<ConnectPorts, 'transport' | 'hosted'>;

function pairFailed(kind: PairFailure): ConnectAction {
  return Object.freeze({ type: 'pairFailed', kind });
}

/**
 * Reads the discovery document at `origin`: `discovered` with nextStepFor's word, or
 * `discoveryFailed` with its kind; null when the caller aborted (Back), so nothing is fed back.
 */
export async function discover(
  origin: string,
  { transport, hosted }: DiscoveryPorts,
  signal?: AbortSignal,
): Promise<ConnectAction | null> {
  try {
    const discovery = await fetchDiscovery(discoveryServerFor(origin, hosted), {
      transport,
      signal,
    });
    const next = nextStepFor(discovery, origin, hosted?.apiUrl ?? null);
    return Object.freeze({ type: 'discovered', origin, discovery, next });
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) return null;
    const kind = discoveryFailureFor(error);
    logger.warn('[connect] discovery gave Connect nothing to read', kind, error);
    return Object.freeze({ type: 'discoveryFailed', origin, kind });
  }
}

async function installIdOf(ports: ConnectPorts): Promise<string | null> {
  try {
    return await ports.installId();
  } catch (error) {
    logger.warn('[connect] the keychain did not give the install id', error);
    return null;
  }
}

/** Saves the pairing: `paired` once the switch is done, `not_saved` when it fails. */
async function keep(record: PairedRecord, ports: ConnectPorts): Promise<ConnectAction> {
  try {
    await ports.connectTo(record);
  } catch (error) {
    // the device store's and the switch's errors name paths and codes, never a value
    logger.warn('[connect] a pairing could not be saved', error);
    return pairFailed('not_saved');
  }
  return Object.freeze({ type: 'paired', record: withoutToken(record) });
}

/**
 * Pairs with the server on the card, once (the caller runs it once per Pair). No abort: once the
 * code has gone out the answer is the token, returned exactly once, so it is always awaited.
 */
export async function pair(details: ConfirmDetails, ports: ConnectPorts): Promise<ConnectAction> {
  const installId = await installIdOf(ports);
  if (installId === null) return pairFailed('keychain');
  try {
    const input = { origin: details.origin, code: details.code, installId, ...ports.device };
    const result = await pairDevice(input, { transport: ports.transport });
    if (!result.ok) return pairFailed(result.reason);
    const record = pairedRecordFrom(details, result.device, ports.now().toISOString());
    return await keep(record, ports);
  } catch (error) {
    // not the server's answer (pairDevice resolves every refusal): a programming error
    logger.error('[connect] pairing failed unexpectedly', error);
    return pairFailed('refused');
  }
}
