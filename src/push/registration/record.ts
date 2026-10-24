// The push record (KP18): what this phone keeps about its registration — the server and workspace
// it registered with, its device row's id, the push_key W1 minted for that row (the signature key,
// KP6), the Expo token it sent, the fingerprint of everything it sent, when, and whether it told the
// server that the OS switched notifications off (KP10, so that PATCH goes once). Pure: the schema,
// the fingerprint and the 24 h rule; key-store.ts keeps the record in the keychain. Never logged.

import { z } from 'zod';

import {
  EXPO_PUSH_TOKEN_MAX_LENGTH,
  EXPO_PUSH_TOKEN_PATTERN,
  PUSH_KEY_MAX_LENGTH,
  REREGISTER_AFTER_MS,
  UUID_PATTERN,
} from '../config';

export const pushRecordSchema = z.object({
  serverOrigin: z.string().min(1),
  workspaceId: z.string().min(1),
  deviceId: z.string().regex(UUID_PATTERN),
  pushKey: z.string().min(1).max(PUSH_KEY_MAX_LENGTH),
  expoToken: z.string().max(EXPO_PUSH_TOKEN_MAX_LENGTH).regex(EXPO_PUSH_TOKEN_PATTERN),
  fingerprint: z.string().min(1),
  /** This phone's clock when the server took the registration, in epoch milliseconds. */
  registeredAt: z.number().int().nonnegative(),
  /** true once PATCH push_enabled false went for an OS switch-off; a registration clears it. */
  switchedOff: z.boolean().default(false),
});

export type PushRecord = Readonly<z.output<typeof pushRecordSchema>>;

/** The server and workspace a record belongs to: the session's, or the record is not this one's. */
export type RecordScope = Readonly<{ serverOrigin: string; workspaceId: string }>;

/** The record when it was made for this server and workspace, else null (another session's). */
export function recordFor(record: PushRecord | null, scope: RecordScope): PushRecord | null {
  if (!record) return null;
  const same =
    record.serverOrigin === scope.serverOrigin && record.workspaceId === scope.workspaceId;
  return same ? record : null;
}

/** Everything a registration sends that, changed, means sending it again (KP10). */
export type FingerprintInput = RecordScope &
  Readonly<{
    installId: string;
    expoToken: string;
    locale: string;
    timeZone: string;
    appVersion: string;
    name: string | null;
  }>;

/** One string over the facts in a fixed order; equal facts give the same string. */
export function fingerprintOf(input: FingerprintInput): string {
  return JSON.stringify([
    input.serverOrigin,
    input.workspaceId,
    input.installId,
    input.expoToken,
    input.locale,
    input.timeZone,
    input.appVersion,
    input.name ?? '',
  ]);
}

/**
 * A registration is due when there is no record, the OS switch-off was reported, a fact changed,
 * or REREGISTER_AFTER_MS has passed (a clock set back counts as passed).
 */
export function isRegistrationDue(
  record: PushRecord | null,
  fingerprint: string,
  now: number,
): boolean {
  if (!record || record.switchedOff || record.fingerprint !== fingerprint) return true;
  const age = now - record.registeredAt;
  return age < 0 || age >= REREGISTER_AFTER_MS;
}
