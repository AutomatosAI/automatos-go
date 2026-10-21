// Pairing a phone (PRD-266 §4.3): POST /api/v1/mobile/pair exchanges the one-time code from Studio
// for a device token, returned exactly once. The call goes through the one client with NO
// credential: no bearer, no X-Workspace-ID and a no-op expiry callback, so a wrong code's 401 never
// reaches a signed-in session's expiry path. Every refusal becomes one PairRefusal with its own
// words (strings.ts). The token is handed back to the caller and nowhere else: nothing here logs,
// and the client's errors carry a kind, a status and a code, never a body.

import { createApiClient } from '../api/client';
import { isApiError, type ApiError } from '../api/errors';
import type { Server } from '../api/server';
import type { Transport } from '../api/transport-types';
import { parseServerAddress } from './address';
import { INVALID_PAIRING_CODE } from './config';
import type { DevicePlatform } from './device-info';
import { normalizePairCode } from './pair-code';
import { CONNECT_ROUTES } from './routes';
import { pairResponseSchema, type PairResponse } from './schemas';

export type PairRefusal =
  /** a wrong, expired or used code (the pending one is not spent) */
  | 'bad_code'
  /** the route is closed: not a local install, or LOCAL_REMOTE_ACCESS is not 'paired' */
  | 'pairing_off'
  /** this network spent its pairing attempts for now */
  | 'too_many'
  /** a concurrent change or the server failing: worth another try */
  | 'busy'
  /** no answer: the address, the network or a timeout */
  | 'unreachable'
  /** an answer this version cannot read, or a token that is not a device token */
  | 'invalid_response'
  /** any other refusal (a status the server does not send for /pair) */
  | 'refused';

export type PairInput = {
  /** A server origin as parseServerAddress returned it. */
  readonly origin: string;
  /** As typed or scanned; always sent in the canonical 'XXXX-XXXX' form (KC7). */
  readonly code: string;
  readonly installId: string;
  readonly name: string;
  readonly platform: DevicePlatform;
  readonly appVersion?: string;
};

export type PairOptions = {
  /** The shell wires expoTransport (as use-launch.ts does for discovery); tests a fake. */
  readonly transport: Transport;
  readonly signal?: AbortSignal;
};

/** The paired device, token included: the caller keeps it in the device store and nowhere else. */
export type PairedDevice = {
  readonly deviceId: string;
  readonly workspaceId: string;
  readonly token: string;
  /** ISO 8601: when the token should be rotated (US-006i). */
  readonly rotateAfter: string;
};

export type PairResult =
  | { readonly ok: true; readonly device: PairedDevice }
  | { readonly ok: false; readonly reason: PairRefusal };

const UNAUTHORIZED = 401;
const SERVER_FAILURE_MIN = 500;
const STATUS_REFUSALS: ReadonlyMap<number, PairRefusal> = new Map<number, PairRefusal>([
  [404, 'pairing_off'],
  [409, 'busy'],
  [429, 'too_many'],
]);

/** The refusal an ApiError from POST /pair stands for. */
export function pairRefusalFor(error: ApiError): PairRefusal {
  if (error.kind === 'network') return 'unreachable';
  if (error.kind === 'invalid_response') return 'invalid_response';
  if (error.status === undefined) return 'refused';
  if (error.status === UNAUTHORIZED) {
    return error.code === INVALID_PAIRING_CODE ? 'bad_code' : 'refused';
  }
  const named = STATUS_REFUSALS.get(error.status);
  if (named) return named;
  return error.status >= SERVER_FAILURE_MIN ? 'busy' : 'refused';
}

/**
 * The server to pair with. The origin must be one parseServerAddress accepts as it stands, so a
 * code is never sent over http to a public address however the caller came by the origin.
 */
function pairingServer(origin: string): Server {
  const address = parseServerAddress(origin);
  if (!address.ok || address.origin !== origin) {
    throw new RangeError('pairDevice needs a server origin from parseServerAddress');
  }
  return Object.freeze({ apiUrl: address.origin, webUrl: '', source: 'own' });
}

function pairBody(input: PairInput, code: string) {
  return {
    code,
    name: input.name,
    platform: input.platform,
    app_version: input.appVersion,
    install_id: input.installId,
  };
}

function pairedDevice(answer: PairResponse): PairedDevice {
  return Object.freeze({
    deviceId: answer.device_id,
    workspaceId: answer.workspace_id,
    token: answer.token,
    rotateAfter: answer.rotate_after,
  });
}

function refuse(reason: PairRefusal): PairResult {
  return Object.freeze({ ok: false, reason });
}

/**
 * Pairs this phone once. A refusal resolves with its reason; an abort (the caller's signal) and a
 * programming error (an origin that is not one) still throw, because neither is the server's answer.
 */
export async function pairDevice(
  input: PairInput,
  { transport, signal }: PairOptions,
): Promise<PairResult> {
  const code = normalizePairCode(input.code);
  if (!code.ok) return refuse('bad_code');
  const anonymous = createApiClient({
    server: pairingServer(input.origin),
    getToken: async () => null,
    getWorkspaceId: () => null,
    transport,
    onAuthExpired: () => undefined,
  });
  try {
    const answer = await anonymous.request(CONNECT_ROUTES.pair, {
      schema: pairResponseSchema,
      body: pairBody(input, code.code),
      signal,
    });
    return Object.freeze({ ok: true, device: pairedDevice(answer) });
  } catch (error) {
    if (isApiError(error)) return refuse(pairRefusalFor(error));
    throw error;
  }
}
