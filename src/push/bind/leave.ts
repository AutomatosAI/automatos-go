// Leaving a session clears push first (US-014i, PRD-001 §4.8, KP16, KP18, W2 US-009). The hosted
// Sign out on Account (the connect kit's ServerSection, use-push-sign-out.ts), Forget this server
// and a new pairing that replaces the server (the connect kit's switch.ts) run the session's leave
// through the phone link (before-leaving.ts) before the provider is cleared; an own server's ended
// pairing runs it from the provider's onExpired (PushRoot). In order: the session's one registrar is
// closed (the run under way ends and none starts after it, so a resume or a new token never
// registers the phone again); on the hosted server only, DELETE /api/v1/mobile/devices/{device_id}
// for the row the push record names (or a Remove this phone the server has not confirmed:
// removal-owed.ts) — or, with no record, the row the registrar last heard the
// server answer (a registration whose answer came while the registrar was closing, or a row with no
// key), else the row learned for a registration whose answer was lost (registration/attempts.ts) —
// with the still-valid Clerk token, best effort: learning the row and the DELETE together within
// SIGN_OUT_DELETE_TIMEOUT_MS (a row already gone counts); then teardownLocal, even when the DELETE
// failed. An own server's row is the connect kit's to revoke (remove-device.ts, with the device's own
// token), so push never DELETEs there: Forget this server sends ONE DELETE. A row whose DELETE
// failed is remembered in memory for this session, so a sign-out that Clerk then refused (offline)
// revokes it on the next try although the record is gone. A hosted Clerk session that merely
// expired: push keeps the record and clears only the badge and the delivered notifications
// (expiry); the shell's own expiry sign-out (useSignOutOnExpiry → Clerk's signOut) then wipes every
// registered keychain item, the push record with it, and its row stays active on the server until
// this phone signs in again (KP10's key recovery revokes and registers it again). A record of another
// server found when a session starts (one forgotten while push was not mounted: Not running →
// Forget this server) is cleared before the first registration (clearLeftover). Pure over its
// ports; never rejects. Logs carry kinds only: never the device id, the key or the token.

import { logger } from '../../lib/logger';
import { SIGN_OUT_DELETE_TIMEOUT_MS } from '../config';
import type { RegistrationAttempts } from '../registration/attempts';
import type { PushKeyStore } from '../registration/key-store';
import type { RecordScope } from '../registration/record';
import type { Registrar } from '../registration/registrar';
import type { RemovalOwed } from '../registration/removal-owed';
import type { PushSource } from '../registration/state';
import { clearShown, teardownLocal, type TeardownDeps, type TeardownStep } from '../teardown';
import { goneAlready, recordedDeviceId } from './remove-phone';

export type LeaveDeps = Readonly<{
  source: PushSource;
  /** This session's server and workspace: the push record's row is read in it. */
  scope: RecordScope;
  /** The session's one registrar: closed first; latest() names the row the server last answered. */
  registrar: Pick<Registrar, 'close' | 'latest'>;
  store: Pick<PushKeyStore, 'load'>;
  /** DELETE /api/v1/mobile/devices/{device_id} through the session's client (api.ts). */
  revoke: (deviceId: string, signal: AbortSignal) => Promise<void>;
  /** The row of a registration whose answer was lost (attempts.ts learnRowId); null: none. */
  learn?: (signal: AbortSignal) => Promise<string | null>;
  /** That note, cleared once a DELETE in this scope is confirmed (and kept when it is not). */
  attempts?: Pick<RegistrationAttempts, 'clear'>;
  /** A Remove this phone the server has not confirmed: its row is revoked here too. */
  owed?: Pick<RemovalOwed, 'owed' | 'settle'>;
  teardown: TeardownDeps;
  timeoutMs?: number;
}>;

export type LeaveOutcome = Readonly<{
  /** Hosted: the server took the DELETE, or the row was already gone. Own server: never asked. */
  revoked: boolean;
  failed: readonly TeardownStep[];
}>;

/** The session's leave: what the phone link carries for the sign-out and the switch. */
export type PushLeave = () => Promise<LeaveOutcome>;

/** The task's answer, or late() once timeoutMs has passed (the task's signal is aborted then). */
async function withinTime<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  late: () => T,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(late());
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/** The DELETE's answer: true, or a row already gone; false on a refusal or no network. */
function revokedOrGone(
  revoke: LeaveDeps['revoke'],
  deviceId: string,
  signal: AbortSignal,
): Promise<boolean> {
  return Promise.resolve()
    .then(() => revoke(deviceId, signal))
    .then(() => true, goneAlready);
}

/** The learned row, or null; a learn that fails is none. */
function learned(learn: LeaveDeps['learn'], signal: AbortSignal): Promise<string | null> {
  if (!learn) return Promise.resolve(null);
  return Promise.resolve()
    .then(() => learn(signal))
    .catch(() => null);
}

function lateSignOut(): boolean {
  logger.warn('[push] the server did not answer the sign-out in time');
  return false;
}

/**
 * The registrar ended for the session, waiting at most timeoutMs for the run under way (closed at
 * once, it keeps no record after); a close that fails or hangs is logged and leaving goes on.
 */
function closed(registrar: LeaveDeps['registrar'], timeoutMs: number): Promise<void> {
  const closing = () =>
    Promise.resolve()
      .then(() => registrar.close())
      .catch(() => logger.warn('[push] could not close the registrar before leaving'));
  return withinTime(closing, timeoutMs, () =>
    logger.warn('[push] the registration under way did not end in time; leaving anyway'),
  );
}

/** The row the registrar last heard the server answer for this phone; null before any answer. */
function answeredRow(registrar: LeaveDeps['registrar']): string | null {
  return registrar.latest()?.facts.serverRow?.deviceId ?? null;
}

export function pushLeaveFor(deps: LeaveDeps): PushLeave {
  const timeoutMs = deps.timeoutMs ?? SIGN_OUT_DELETE_TIMEOUT_MS;
  let tried = false;
  let unrevoked: string | null = null;
  // the record's row; with none, on the first leave the row the server answered or the one learned,
  // and on a later one the row whose DELETE failed
  const rowToRevoke = async (signal: AbortSignal): Promise<string | null> => {
    const recorded =
      (await recordedDeviceId(deps.store, deps.scope)) ?? deps.owed?.owed(deps.scope) ?? null;
    if (recorded) return recorded;
    if (tried) return unrevoked;
    return answeredRow(deps.registrar) ?? (await learned(deps.learn, signal));
  };
  const signOut = async (): Promise<boolean> => {
    const found: { deviceId: string | null } = { deviceId: null };
    const attempt = async (signal: AbortSignal) => {
      found.deviceId = await rowToRevoke(signal);
      return found.deviceId !== null && revokedOrGone(deps.revoke, found.deviceId, signal);
    };
    const revoked = await withinTime(attempt, timeoutMs, lateSignOut);
    tried = true;
    unrevoked = revoked ? null : found.deviceId;
    if (revoked) {
      deps.attempts?.clear(deps.scope);
      deps.owed?.settle(deps.scope);
    }
    return revoked;
  };
  return async () => {
    await closed(deps.registrar, timeoutMs);
    const revoked = deps.source === 'hosted' && (await signOut());
    const { failed } = await teardownLocal(deps.teardown);
    return Object.freeze({ revoked, failed });
  };
}

export type ExpiryDeps = Readonly<{
  source: PushSource;
  leave: PushLeave;
  port: TeardownDeps['port'];
}>;

/**
 * The provider's onExpired: an own server that ended this pairing (device_revoked, pairing
 * required, ended) leaves push; for a hosted Clerk session push clears only what the phone shows
 * (the shell's expiry sign-out wipes the keychain itself). Never rejects.
 */
export async function onSessionExpired({ source, leave, port }: ExpiryDeps): Promise<void> {
  if (source === 'own') await leave();
  else await clearShown({ port });
}

export type LeftoverDeps = Readonly<{
  /** This session's server: a record of any other server is a leftover. */
  serverOrigin: string;
  store: Pick<PushKeyStore, 'load'>;
  teardown: TeardownDeps;
}>;

/** The stored record's server; null with none or a keychain that refused the read. */
async function storedOrigin(store: LeftoverDeps['store']): Promise<string | null> {
  try {
    return (await store.load())?.serverOrigin ?? null;
  } catch {
    logger.warn('[push] the keychain refused the push record; nothing cleared');
    return null;
  }
}

/** A push record of another server is cleared (true); this server's, none or unreadable: kept. */
export async function clearLeftover({
  serverOrigin,
  store,
  teardown,
}: LeftoverDeps): Promise<boolean> {
  const origin = await storedOrigin(store);
  if (origin === null || origin === serverOrigin) return false;
  await teardownLocal(teardown);
  return true;
}
