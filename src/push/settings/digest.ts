// The daily digest's switch and time (PRD-001 §4.7, D-DIGEST, KP12), pure. The switch is the
// 'daily_digest' push row (W2 K12, on by default) through setPushType, so the bulk PUT keeps every
// other row of that event. The time is THIS phone's device row: PATCH
// /api/v1/mobile/devices/{device_id} {digest_time}; the server follows the person's most recently
// seen phone with a time zone (W2 K12), which the screen's copy says. Neither shows without the
// 'push' and 'digest' capabilities (D-CAPABILITIES).

import type { ApiClient } from '../../api/client';
import { canDigest, canPush, type GateInput } from '../../api/capabilities';
import { updateDevice, type DeviceChanges } from '../api';
import type { Device, PreferenceRow, Preferences, PreferencesSaved } from '../schemas/server';
import { pushTypesOf, savePushType, setPushType, switchState } from './prefs';

/** The times a person picks from (D24), in the phone's time zone. */
export const DIGEST_TIMES = Object.freeze(['07:00', '08:00', '09:00'] as const);

export type DigestTime = (typeof DIGEST_TIMES)[number];

/** W2's DIGEST_DEFAULT_TIME: what the server uses for a row with no digest_time. */
export const DIGEST_DEFAULT: DigestTime = '08:00';

export function isDigestTime(value: unknown): value is DigestTime {
  return (DIGEST_TIMES as readonly unknown[]).includes(value);
}

/** The digest switch and time are offered only when the server sends push and the digest. */
export function digestShown(discovery: GateInput): boolean {
  return canPush(discovery) && canDigest(discovery);
}

/** This phone's digest time as its row says, else the server's default. */
export function digestTimeOf(device: Pick<Device, 'digest_time'> | null | undefined): string {
  return device?.digest_time ?? DIGEST_DEFAULT;
}

/** The PATCH body for a new time; a time the picker does not offer throws before anything is sent. */
export function digestTimeChange(time: string): DeviceChanges {
  if (!isDigestTime(time)) throw new TypeError('A digest time is one of the offered times');
  return Object.freeze({ digest_time: time });
}

/** Sets THIS phone's digest time; never queued or retried (D-WRITES). */
export function saveDigestTime(client: ApiClient, deviceId: string, time: string): Promise<Device> {
  return updateDevice(client, deviceId, digestTimeChange(time));
}

/** On unless the 'daily_digest' push row says off (no row means on, W2 K7). */
export function digestOn(response: Preferences): boolean {
  return switchState(response.preferences, pushTypesOf(response).digest);
}

/** The PUT body that turns the digest on or off. */
export function setDigest(response: Preferences, enabled: boolean): readonly PreferenceRow[] {
  return setPushType(response.preferences, pushTypesOf(response).digest, enabled);
}

export function saveDigest(
  client: ApiClient,
  response: Preferences,
  enabled: boolean,
): Promise<PreferencesSaved> {
  return savePushType(client, response.preferences, pushTypesOf(response).digest, enabled);
}
