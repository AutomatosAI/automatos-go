// This phone's push state, from facts (PRD-001 §4.8, KP10, D-CAPABILITIES, D-SELF-HOSTED): what
// the Notifications screen says, and the one step registration takes next. Pure: no I/O, and the
// facts are never changed. The server must list 'push' and send through Expo (push.expo), and the
// build must carry its EAS projectId, before anything registers; then the OS permission decides;
// then the person's Remove this phone (held, KP16: 'ask' until their tap); then what the server
// last answered. A 409 is remembered as a status for this launch and never retried by itself (a
// person's tap or the next launch tries again).

import type { Device, DeviceConflictCode } from '../schemas/server';
import type { PushRecord } from './record';

export type PushSource = 'hosted' | 'own';

export type PermissionState = 'undetermined' | 'granted' | 'denied';

/** Why the server turned this phone's push off (W2 K14, K15), as its row says. */
export const OFF_REASONS = ['DeviceNotRegistered', 'token_moved', 'device_revoked'] as const;

export type OffReason = (typeof OFF_REASONS)[number] | 'other';

/** This phone's row as the server last answered it; push_enabled is unknown after a POST. */
export type ServerRow = Readonly<{
  deviceId: string;
  pushEnabled: boolean | null;
  disabledReason: string | null;
}>;

export type PushFacts = Readonly<{
  capabilityPush: boolean;
  pushExpo: boolean;
  source: PushSource;
  /** The build's EAS project id; null until the owner's eas init (foundation OT-1). */
  projectId: string | null;
  permission: PermissionState;
  /** The stored record, when it belongs to this server and workspace (recordFor). */
  record: PushRecord | null;
  serverRow: ServerRow | null;
  lastConflict: DeviceConflictCode | null;
  /** The person removed this phone here (removal-hold.ts): nothing registers until their tap. */
  held: boolean;
}>;

export type PushStatusKind =
  | 'unsupported'
  | 'operator_off'
  | 'not_configured'
  | 'ask'
  | 'denied'
  | 'on'
  | 'revoked_by_admin'
  | 'token_elsewhere'
  | 'key_missing';

export type PushStatus =
  Readonly<{ kind: PushStatusKind }> | Readonly<{ kind: 'off'; reason: OffReason }>;

export type NextStep = 'none' | 'register' | 'switch_off' | 'recover_key';

const status = (kind: PushStatusKind): PushStatus => Object.freeze({ kind });
const off = (reason: OffReason): PushStatus => Object.freeze({ kind: 'off', reason });

const UNSUPPORTED = status('unsupported');
const OPERATOR_OFF = status('operator_off');
const NOT_CONFIGURED = status('not_configured');
const ASK = status('ask');
const DENIED = status('denied');
const ON = status('on');
const KEY_MISSING = status('key_missing');
const OFF_OTHER = off('other');

/** A 409 → its status: an admin's revoke stands; another row holds the token; the rest is 'other'. */
const CONFLICT_STATUSES: Readonly<Record<DeviceConflictCode, PushStatus>> = Object.freeze({
  device_revoked: status('revoked_by_admin'),
  push_token_in_use: status('token_elsewhere'),
  install_id_mismatch: OFF_OTHER,
  install_id_paired: OFF_OTHER,
  push_token_missing: OFF_OTHER,
});

function isOffReason(reason: string | null): reason is (typeof OFF_REASONS)[number] {
  return OFF_REASONS.some((known) => known === reason);
}

/**
 * Nothing registers where the server cannot push, or this build cannot get a token. The Settings
 * screen reads it too, before the first registration run has answered.
 */
export function gateStatus(
  facts: Pick<PushFacts, 'capabilityPush' | 'pushExpo' | 'projectId'>,
): PushStatus | null {
  if (!facts.capabilityPush) return UNSUPPORTED;
  if (!facts.pushExpo) return OPERATOR_OFF;
  if (!facts.projectId) return NOT_CONFIGURED;
  return null;
}

/** The server has a row for this phone, and the phone holds no key for that row. */
export function isKeyless(facts: Pick<PushFacts, 'record' | 'serverRow'>): boolean {
  const row = facts.serverRow;
  return row !== null && row.deviceId !== facts.record?.deviceId;
}

function registrationStatus(facts: PushFacts): PushStatus {
  if (facts.lastConflict) return CONFLICT_STATUSES[facts.lastConflict];
  if (isKeyless(facts)) return KEY_MISSING;
  // granted, but not registered yet (a token, a time zone or the network to wait for)
  if (!facts.record || facts.record.switchedOff) return OFF_OTHER;
  const row = facts.serverRow;
  if (row?.pushEnabled !== false) return ON;
  return off(isOffReason(row.disabledReason) ? row.disabledReason : 'other');
}

export function pushStatus(facts: PushFacts): PushStatus {
  const gated = gateStatus(facts);
  if (gated) return gated;
  if (facts.permission === 'undetermined') return ASK;
  if (facts.permission === 'denied') return DENIED;
  if (facts.held) return ASK;
  return registrationStatus(facts);
}

/**
 * The step this run takes. 'register' sends only when the fingerprint changed or 24 h passed
 * (register.ts decides); 'recover_key' is a hosted phone's only (an own server's DELETE would end
 * its device token, so it stays 'key_missing'); 'switch_off' goes once per OS switch-off.
 */
export function nextStep(facts: PushFacts): NextStep {
  if (gateStatus(facts)) return 'none';
  if (facts.permission === 'denied') {
    return facts.record && !facts.record.switchedOff ? 'switch_off' : 'none';
  }
  if (facts.permission !== 'granted' || facts.lastConflict || facts.held) return 'none';
  if (isKeyless(facts)) return facts.source === 'hosted' ? 'recover_key' : 'none';
  return 'register';
}

/** A row from GET /api/v1/mobile/devices, as these facts read it. */
export function serverRowOf(device: Device): ServerRow {
  return Object.freeze({
    deviceId: device.id,
    pushEnabled: device.push_enabled,
    disabledReason: device.push_disabled_reason,
  });
}
