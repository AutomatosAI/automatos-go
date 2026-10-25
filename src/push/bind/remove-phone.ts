// Remove this phone on a hosted phone's Account (PRD-001 §4.7, KP16, D63): the phone leaves its
// workspace's devices and stays signed in. In order: the scope is held first (removal-hold.ts), so
// no run from now on registers it again; the run under way, if any, ends (the session's one
// registrar, awaited) before the row goes, and the row's id is read after it; DELETE
// /api/v1/mobile/devices/{device_id} (a row already gone counts as removed); teardownLocal clears
// the push record, the badge, the delivered notifications and the counters, even when the DELETE
// failed; a last run reads the held state back, so PushRoot and Settings → Notifications see 'ask'
// until the person turns notifications on again. An own server keeps the connect kit's 'Remove
// this phone and forget this server' (one button, never two). Pure over its ports; never rejects.
// Logs carry kinds only: never the device id, the key or the token.

import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import type { PushKeyStore } from '../registration/key-store';
import { recordFor, type RecordScope } from '../registration/record';
import type { Registrar } from '../registration/registrar';
import type { RemovalHold } from '../registration/removal-hold';
import type { PushSource, PushStatus } from '../registration/state';
import { PUSH_ACCOUNT_COPY } from '../strings';
import { teardownLocal, type TeardownDeps } from '../teardown';

export type RemovalDeps = Readonly<{
  /** This session's server and workspace. */
  scope: RecordScope;
  hold: Pick<RemovalHold, 'hold'>;
  /** The session's one registrar (the reporting one, so PushRoot hears the held answer). */
  registrar: Pick<Registrar, 'run'>;
  store: Pick<PushKeyStore, 'load'>;
  /** DELETE /api/v1/mobile/devices/{device_id} through the session's client (api.ts). */
  revoke: (deviceId: string) => Promise<void>;
  teardown: TeardownDeps;
}>;

export type RemovalOutcome = Readonly<{
  /** The server took the DELETE, or the row was already gone; false: Studio may still list it. */
  removed: boolean;
  status: PushStatus;
}>;

/** What the Account screen may call, attached through the phone link (settings/phone-link.ts). */
export type PhoneRemoval = Readonly<{
  /** This session's push record's device row; null with none, another session's, or no keychain. */
  deviceId: () => Promise<string | null>;
  remove: () => Promise<RemovalOutcome>;
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

export async function removePhone(deps: RemovalDeps): Promise<RemovalOutcome> {
  deps.hold.hold(deps.scope);
  await deps.registrar.run();
  const deviceId = await recordedDeviceId(deps.store, deps.scope);
  const removed = deviceId !== null && (await revoked(deps, deviceId));
  await teardownLocal(deps.teardown);
  const after = await deps.registrar.run();
  return Object.freeze({ removed, status: after?.status ?? ASK });
}

export function phoneRemovalFor(deps: RemovalDeps): PhoneRemoval {
  return Object.freeze({
    deviceId: () => recordedDeviceId(deps.store, deps.scope),
    remove: () => removePhone(deps),
  });
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
