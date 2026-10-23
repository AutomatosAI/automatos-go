// What a paired phone's own server must say for the shell to open it (US-006d). Discovery is read
// at the record's origin with no bearer (src/api/discovery.ts; K3's hosted defaults never apply to
// an own server), and the server must still sign phones in by pairing: 'device' in auth.modes and
// pairing.enabled. A server from before PRD-266 W1 answers 404 (no document). A server that does
// not answer at all is not running (the gate's 'not_running', not an error with a status). Pure.

import type { Discovery } from '../api/discovery';
import { isApiError } from '../api/errors';
import type { AuthMode } from '../auth/providers/types';
import { NOT_RUNNING_GATEWAY_STATUSES } from './config';

export type OwnServerRefusal =
  /** 404 on the discovery document: its Automatos is older than paired phones */
  | 'no_discovery'
  /** It no longer signs phones in by pairing (no 'device' in auth.modes) */
  | 'no_device'
  /** It signs paired phones in, but its operator has turned pairing off */
  | 'pairing_off';

const DEVICE_MODE: AuthMode = 'device';

/** null when the server takes this phone's pairing; otherwise why not. */
export function ownDiscoveryRefusal(
  discovery: Pick<Discovery, 'auth' | 'pairing'>,
): OwnServerRefusal | null {
  if (!discovery.auth.modes.includes(DEVICE_MODE)) return 'no_device';
  return discovery.pairing.enabled ? null : 'pairing_off';
}

/** No answer (unreachable, timed out), or a gateway in front of it that cannot reach it. */
export function isNotRunning(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.kind === 'network' || NOT_RUNNING_GATEWAY_STATUSES.includes(error.status ?? 0);
}

/** The discovery document is not there: a server from before PRD-266 W1. */
export function isWithoutDiscovery(error: unknown): boolean {
  return isApiError(error) && error.kind === 'not_found';
}
