// Why a paired phone's token stopped working (US-006 AC4, PRD-266 §4.3): the device lane answers a
// revoked row 401 {"detail": {"code": "device_revoked"}}, a request with no credential on a paired
// install 401 {"detail": {"code": "device_pairing_required"}}, and every other miss (an unknown or
// rotated-out token, a deactivated person) a plain 401. The one client keeps the code
// (src/api/errors.ts detailOf → ApiError.code); this reads it. Pure: the provider
// (src/auth/providers/device.ts) acts on it and Connect shows its words.

import { isApiError } from '../api/errors';
import { DEVICE_PAIRING_REQUIRED, DEVICE_REVOKED } from './config';
import { DEVICE_REFUSAL_COPY } from './strings';

export type DeviceRefusalReason =
  /** Removed in Studio → Settings → Phones & devices (or by this phone's Remove) */
  | 'revoked'
  /** The server only answers paired devices and this call carried no token */
  | 'pairing_required'
  /** Any other 401: the token is unknown, rotated out or its person deactivated */
  | 'ended';

/** A refusal as Connect shows it: the reason and the server it came from. */
export type DeviceRefusal = {
  readonly reason: DeviceRefusalReason;
  readonly serverName: string;
  readonly origin: string;
};

const UNAUTHORIZED = 401;

const REASON_FOR_CODE: ReadonlyMap<string, DeviceRefusalReason> = new Map([
  [DEVICE_REVOKED, 'revoked'],
  [DEVICE_PAIRING_REQUIRED, 'pairing_required'],
]);

/** The reason a 401 names; anything without a known code (or no error at all) is 'ended'. */
export function classifyDeviceRefusal(error: unknown): DeviceRefusalReason {
  if (!isApiError(error) || error.status !== UNAUTHORIZED || !error.code) return 'ended';
  return REASON_FOR_CODE.get(error.code) ?? 'ended';
}

/** Connect's words for a refusal, naming the server. */
export function refusalMessage({ reason, serverName }: DeviceRefusal): string {
  return DEVICE_REFUSAL_COPY[reason](serverName);
}
