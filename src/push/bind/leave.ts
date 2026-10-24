// Leaving a session clears push first (US-014i, PRD-001 §4.8, KP16, KP18, W2 US-009). The hosted
// Sign out on Account (the connect kit's ServerSection, use-push-sign-out.ts), Forget this server
// and a new pairing that replaces the server (the connect kit's switch.ts) run the session's leave
// through the phone link (before-leaving.ts) before the provider is cleared; an own server's ended
// pairing runs it from the provider's onExpired (PushRoot). In order: the session's one registrar is
// closed (the run under way ends and none starts after it, so a resume or a new token never
// registers the phone again); on the hosted server only, DELETE /api/v1/mobile/devices/{device_id}
// for the row the push record names, with the still-valid Clerk token, best effort within
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
import type { PushKeyStore } from '../registration/key-store';
import type { RecordScope } from '../registration/record';
import type { Registrar } from '../registration/registrar';
import type { PushSource } from '../registration/state';
import { clearShown, teardownLocal, type TeardownDeps, type TeardownStep } from '../teardown';
import { goneAlready, recordedDeviceId } from './remove-phone';

export type LeaveDeps = Readonly<{
  source: PushSource;
  /** This session's server and workspace: the push record's row is read in it. */
  scope: RecordScope;
  /** The session's one registrar. */
  registrar: Pick<Registrar, 'close'>;
  store: Pick<PushKeyStore, 'load'>;
  /** DELETE /api/v1/mobile/devices/{device_id} through the session's client (api.ts). */
  revoke: (deviceId: string, signal: AbortSignal) => Promise<void>;
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

/** The DELETE within its time; false on a refusal, no network or no answer in time. */
function revokedInTime(
  revoke: LeaveDeps['revoke'],
  deviceId: string,
  timeoutMs: number,
): Promise<boolean> {
  const answered = (signal: AbortSignal) =>
    Promise.resolve()
      .then(() => revoke(deviceId, signal))
      .then(() => true, goneAlready);
  return withinTime(answered, timeoutMs, () => {
    logger.warn('[push] the server did not answer the sign-out in time');
    return false;
  });
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

export function pushLeaveFor(deps: LeaveDeps): PushLeave {
  const timeoutMs = deps.timeoutMs ?? SIGN_OUT_DELETE_TIMEOUT_MS;
  let unrevoked: string | null = null;
  const signOut = async (): Promise<boolean> => {
    const deviceId = (await recordedDeviceId(deps.store, deps.scope)) ?? unrevoked;
    const revoked = deviceId !== null && (await revokedInTime(deps.revoke, deviceId, timeoutMs));
    unrevoked = revoked ? null : deviceId;
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
