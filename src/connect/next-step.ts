// What the server's discovery document means for Connect (PRD-001 §4.5, KC15): an own server that
// takes paired phones goes on to the confirm card; one whose operator has pairing off says so; the
// build's own hosted server is a sign-in, not a pairing (→ /sign-in); anything else needs a newer
// Automatos Go: 'oidc' (PRD-257 adds its step HERE, and only here) and a Clerk server that is not
// the built-in one (D1: enterprise runtime Clerk comes after WebSummit). Connect reads discovery at
// the origin the person typed or scanned, which is the origin every later call uses (KC5). Pure.

import type { Discovery } from '../api/discovery';
import { isApiError } from '../api/errors';
import { ownServerFrom, type Server } from '../api/server';
import type { AuthMode } from '../auth/providers/types';
import { parseServerAddress } from './address';
import { isNotRunning, isWithoutDiscovery, ownDiscoveryRefusal } from './server-support';

export type NextStep =
  /** 'device' in auth.modes and pairing on: the confirm card, then POST /pair */
  | 'pair'
  /** 'device' in auth.modes, pairing off (LOCAL_REMOTE_ACCESS is not 'paired') */
  | 'pairing_off'
  /** the build's own hosted server: Sign in to Automatos */
  | 'hosted'
  /** no step this app version has: 'oidc', another Clerk server, or no known mode */
  | 'unsupported';

/** Why discovery gave Connect nothing to read. */
export type DiscoveryFailure =
  /** no answer, or a gateway in front of the server that cannot reach it */
  | 'unreachable'
  /** 404: no discovery document (an Automatos older than paired phones, or another server) */
  | 'no_discovery'
  /** an answer that is not a discovery document this version reads */
  | 'not_automatos'
  /** any other refusal (a misconfigured server answers 500) */
  | 'discovery_failed';

const CLERK_MODE: AuthMode = 'clerk';

/** Does `url` name exactly this origin, under the address rules? */
export function isSameOrigin(url: string, origin: string): boolean {
  const parsed = parseServerAddress(url);
  return parsed.ok && parsed.origin === origin;
}

function isBuiltInHosted(reachedOrigin: string, hostedApiUrl: string | null): boolean {
  return hostedApiUrl !== null && isSameOrigin(hostedApiUrl, reachedOrigin);
}

/**
 * The step after discovery. `hostedApiUrl` is the build's built-in hosted API (K3), or null in a
 * build with none: only a server at exactly that origin is a hosted sign-in.
 */
export function nextStepFor(
  discovery: Pick<Discovery, 'auth' | 'pairing'>,
  reachedOrigin: string,
  hostedApiUrl: string | null,
): NextStep {
  const refusal = ownDiscoveryRefusal(discovery);
  if (refusal === null) return 'pair';
  if (refusal === 'pairing_off') return 'pairing_off';
  const clerk = discovery.auth.modes.includes(CLERK_MODE);
  return clerk && isBuiltInHosted(reachedOrigin, hostedApiUrl) ? 'hosted' : 'unsupported';
}

/**
 * The server discovery is read from: the built-in hosted server when the origin is its API (so its
 * 404 still reads as K3's hosted defaults), otherwise an own server at the origin, with no bearer.
 */
export function discoveryServerFor(origin: string, hosted: Server | null): Server {
  if (hosted && isSameOrigin(hosted.apiUrl, origin)) return hosted;
  return ownServerFrom({ origin, webUrl: '' });
}

/** What a failed discovery read means for Connect. */
export function discoveryFailureFor(error: unknown): DiscoveryFailure {
  if (isNotRunning(error)) return 'unreachable';
  if (isWithoutDiscovery(error)) return 'no_discovery';
  if (isApiError(error) && error.kind === 'invalid_response') return 'not_automatos';
  return 'discovery_failed';
}
