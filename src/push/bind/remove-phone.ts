// Remove this phone on a hosted phone's Account (PRD-001 §4.7, KP16, D63): the phone leaves its
// workspace's devices and stays signed in. In order: the scope is held first (removal-hold.ts), so
// no run from now on registers it again; then, as ONE task in the session's registrar's queue
// (exclusive: after the run under way, before any run asked for meanwhile), the row's id is read,
// DELETE /api/v1/mobile/devices/{device_id} goes (a row already gone counts as removed) and
// teardownLocal clears the push record, the badge, the delivered notifications and the counters,
// even when the DELETE failed — so a 'Turn on' tapped meanwhile registers after it, from a cleared
// phone, and never has its new record wiped. A DELETE the server has not confirmed keeps the row's
// id as a removal owed (removal-owed.ts): the button stays offered, and the next tap, the next
// launch (finishRemoval, while the hold stands) or the next Sign out sends it again; "removed" is
// said only after the server's answer, 404 included. A last run reads the held state back, so PushRoot and
// Settings → Notifications see 'ask' until the person turns notifications on again (or what their
// tap since then turned on). An own server keeps the connect kit's 'Remove
// this phone and forget this server' (one button, never two). Pure over its ports; never rejects.
// Logs carry kinds only: never the device id, the key or the token.

import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import type { RegistrationAttempts } from '../registration/attempts';
import type { PushKeyStore } from '../registration/key-store';
import { recordFor, type RecordScope } from '../registration/record';
import type { Registrar } from '../registration/registrar';
import type { RemovalHold } from '../registration/removal-hold';
import type { RemovalOwed } from '../registration/removal-owed';
import type { PushSource, PushStatus } from '../registration/state';
import { PUSH_ACCOUNT_COPY } from '../strings';
import { teardownLocal, type TeardownDeps } from '../teardown';

export type RemovalDeps = Readonly<{
  /** This session's server and workspace. */
  scope: RecordScope;
  hold: Pick<RemovalHold, 'hold' | 'held'>;
  /** The session's one registrar (the reporting one, so PushRoot hears the held answer). */
  registrar: Pick<Registrar, 'run' | 'exclusive'>;
  store: Pick<PushKeyStore, 'load'>;
  /** DELETE /api/v1/mobile/devices/{device_id} through the session's client (api.ts). */
  revoke: (deviceId: string) => Promise<void>;
  teardown: TeardownDeps;
  /** A lost registration's note (attempts.ts), settled by a DELETE the server confirms. */
  attempts?: Pick<RegistrationAttempts, 'clear'>;
  /** The row of a removal the server has not confirmed, kept to send it again. */
  owed?: RemovalOwed;
}>;

export type RemovalOutcome = Readonly<{
  /** The server took the DELETE, or the row was already gone; false: Studio may still list it. */
  removed: boolean;
  status: PushStatus;
}>;

/** What the Account screen may call, attached through the phone link (settings/phone-link.ts). */
export type PhoneRemoval = Readonly<{
  /** The row to remove: the push record's, else one whose removal is owed; null with neither. */
  deviceId: () => Promise<string | null>;
  remove: () => Promise<RemovalOutcome>;
  /** At launch: an owed removal sent again while the hold stands; true once the server confirms. */
  finish: () => Promise<boolean>;
}>;

const ASK: PushStatus = Object.freeze({ kind: 'ask' });

export async function recordedDeviceId(
  store: Pick<PushKeyStore, 'load'>,
  scope: RecordScope,
): Promise<string | null> {
  try {
    return recordFor(await store.load(), scope)?.deviceId ?? null;
  } catch {
    logger.warn('[push] the keychain refused the push record; no row to remove');
    return null;
  }
}

/** A DELETE that failed: a row already gone (404) counts as removed; any other failure is logged by kind. */
export function goneAlready(error: unknown): boolean {
  if (isApiError(error) && error.kind === 'not_found') return true;
  logger.warn('[push] could not remove this phone from the server', {
    kind: isApiError(error) ? error.kind : 'unknown',
  });
  return false;
}

async function revoked(deps: RemovalDeps, deviceId: string): Promise<boolean> {
  try {
    await deps.revoke(deviceId);
    return true;
  } catch (error) {
    return goneAlready(error);
  }
}

/** The push record's row, else the row of a removal still owed. */
async function rowToRemove(deps: RemovalDeps): Promise<string | null> {
  return (await recordedDeviceId(deps.store, deps.scope)) ?? deps.owed?.owed(deps.scope) ?? null;
}

/** Confirmed: nothing is owed and a lost registration's note is settled; else the row is owed. */
function settled(deps: RemovalDeps, deviceId: string | null, removed: boolean): void {
  if (removed) {
    deps.owed?.settle(deps.scope);
    deps.attempts?.clear(deps.scope);
  } else if (deviceId !== null) {
    deps.owed?.owe(deps.scope, deviceId);
  }
}

/** The row read, revoked and the phone cleared: one task, run between the registrar's runs. */
async function removeRow(deps: RemovalDeps): Promise<boolean> {
  const deviceId = await rowToRemove(deps);
  const removed = deviceId !== null && (await revoked(deps, deviceId));
  settled(deps, deviceId, removed);
  await teardownLocal(deps.teardown);
  return removed;
}

/**
 * The next launch: a removal still owed is sent again while the person's hold stands; one they
 * turned notifications on again since is no longer wanted, and is settled unsent. Never rejects.
 */
export function finishRemoval(deps: RemovalDeps): Promise<boolean> {
  return deps.registrar.exclusive(async () => {
    const deviceId = deps.owed?.owed(deps.scope) ?? null;
    if (deviceId === null) return false;
    if (!deps.hold.held(deps.scope)) {
      deps.owed?.settle(deps.scope);
      return false;
    }
    const removed = await revoked(deps, deviceId);
    settled(deps, deviceId, removed);
    return removed;
  });
}

export async function removePhone(deps: RemovalDeps): Promise<RemovalOutcome> {
  deps.hold.hold(deps.scope);
  const removed = await deps.registrar.exclusive(() => removeRow(deps));
  const after = await deps.registrar.run();
  return Object.freeze({ removed, status: after?.status ?? ASK });
}

export function phoneRemovalFor(deps: RemovalDeps): PhoneRemoval {
  return Object.freeze({
    deviceId: () => rowToRemove(deps),
    remove: () => removePhone(deps),
    finish: () => finishRemoval(deps),
  });
}

/** The yes on Remove this phone, said in a line: never rejects (a failure is the honest line). */
export async function removeAndTell(
  removal: Pick<PhoneRemoval, 'remove'>,
  show: (line: string) => void,
): Promise<RemovalOutcome | null> {
  try {
    const outcome = await removal.remove();
    show(removalNotice(outcome));
    return outcome;
  } catch {
    logger.warn('[push] Remove this phone failed on its way');
    show(removalNotice({ removed: false }));
    return null;
  }
}

export type RemoveShownInput = Readonly<{
  source: PushSource;
  /** PushRoot has attached the session's link (it is mounted). */
  linked: boolean;
  deviceId: string | null;
}>;

/** Only a hosted phone with a push record; an own server's way out is the connect kit's. */
export function removeShown({ source, linked, deviceId }: RemoveShownInput): boolean {
  return source === 'hosted' && linked && deviceId !== null;
}

/** The toast after the yes: removed, or the honest line that Studio may still list it. */
export function removalNotice(outcome: Pick<RemovalOutcome, 'removed'>): string {
  return outcome.removed ? PUSH_ACCOUNT_COPY.removed : PUSH_ACCOUNT_COPY.removeFailed;
}
