// One registration run (PRD-001 §4.8, KP10, KP18): read the facts, take nextStep's one step, answer
// the status. A phone registers (POST /api/v1/mobile/devices) only where the server pushes through
// Expo, the build has its EAS projectId and the OS permission is granted, and only when what it
// would send differs from the record's fingerprint or REREGISTER_AFTER_MS has passed (a person's
// tap sends anyway). A returned push_key is saved BEFORE the registration counts as done; a null
// one keeps the stored key for the same row. No key for the row: a hosted phone revokes its own row
// and registers once more (W1 mints a key after a person's own revoke), at most once per
// RECOVERY_MIN_INTERVAL_MS; an own server stays 'key_missing' (a DELETE would end its device token).
// An OS switch-off sends PATCH push_enabled false once; granted again registers (W2 US-009 turns
// push back on). A 409 becomes a status, never retried here; a network failure keeps the record and
// waits for the next trigger. A scope the person removed this phone from (removal-hold.ts, KP16)
// takes no step and answers 'ask', with no row remembered, until a person's tap releases it. Once
// the session has ended (deps.active false) nothing more is sent or kept. Never throws. Logs carry
// kinds and codes only: never the token or key.

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import { registerDevice, revokeDevice, updateDevice, type RegistrationInput } from '../api';
import type { NotificationsPort } from '../platform/expo';
import { deviceConflictOf, type Registration } from '../schemas/server';
import type { DeviceFacts, DeviceSource } from './device-facts';
import type { PushKeyStore } from './key-store';
import { readPermission } from './permission';
import { fingerprintOf, isRegistrationDue, recordFor, type PushRecord } from './record';
import { recoveryAllowed, type RecoveryLog } from './recovery-log';
import type { RemovalHold } from './removal-hold';
import {
  nextStep,
  pushStatus,
  type NextStep,
  type PushFacts,
  type PushSource,
  type PushStatus,
  type ServerRow,
} from './state';

/** The signed-in or paired session this phone registers in (bound in US-014h). */
export type RegistrationSession = Readonly<{
  source: PushSource;
  serverOrigin: string;
  workspaceId: string;
  capabilityPush: boolean;
  pushExpo: boolean;
  /** The connect kit's install id (src/connect/install-id.ts), never a second one. */
  getInstallId: () => Promise<string | null>;
}>;

export type RegisterDeps = Readonly<{
  session: RegistrationSession;
  client: ApiClient;
  port: Pick<NotificationsPort, 'getPermissionsAsync'>;
  device: DeviceSource;
  store: PushKeyStore;
  recoveries: RecoveryLog;
  /** Remove this phone's hold (KP16): read on each run, released by a person's tap. */
  hold: Pick<RemovalHold, 'held' | 'release'>;
  now: () => number;
  /** false once the session ended (the registrar's close()): no write is sent, no record kept. */
  active?: () => boolean;
}>;

/** What one run tells the next in this launch: the row the server answered, and its 409. */
export type RegistrationMemory = Readonly<Pick<PushFacts, 'serverRow' | 'lastConflict'>>;

export const NO_MEMORY: RegistrationMemory = Object.freeze({ serverRow: null, lastConflict: null });

export type RegisterOptions = Readonly<{
  /** A person's tap ('Turn on', 'Turn on again'): sends though nothing changed, past a 409. */
  force?: boolean;
}>;

export type RegistrationOutcome = Readonly<{
  step: NextStep;
  status: PushStatus;
  facts: PushFacts;
}>;

type Run = Readonly<{ deps: RegisterDeps; device: DeviceFacts; force: boolean }>;

type Prepared = Readonly<{ input: RegistrationInput; fingerprint: string; expoToken: string }>;

const isActive = (deps: RegisterDeps): boolean => deps.active?.() ?? true;

function kindOf(error: unknown): string {
  return isApiError(error) ? error.kind : 'unknown';
}

/** The stored record; undefined when the keychain refused the read (then nothing is sent). */
async function storedRecord(store: PushKeyStore): Promise<PushRecord | null | undefined> {
  try {
    return await store.load();
  } catch {
    logger.warn('[push] the keychain refused the push record; registration waits');
    return undefined;
  }
}

async function installIdOf(session: RegistrationSession): Promise<string | null> {
  try {
    return await session.getInstallId();
  } catch {
    logger.warn('[push] could not read the install id; registration waits');
    return null;
  }
}

async function saved(deps: RegisterDeps, record: PushRecord): Promise<boolean> {
  if (!isActive(deps)) return false;
  try {
    await deps.store.save(record);
    return true;
  } catch {
    logger.warn('[push] could not keep the push record');
    return false;
  }
}

/** Everything a registration sends, or null while a fact is missing (it waits). */
async function prepare({ deps, device }: Run, facts: PushFacts): Promise<Prepared | null> {
  const { appVersion, locale, timeZone, name } = device;
  if (!facts.projectId || !appVersion || !locale || !timeZone) return null;
  const [installId, expoToken] = await Promise.all([
    installIdOf(deps.session),
    deps.device.expoToken(facts.projectId),
  ]);
  if (!installId || !expoToken) return null;
  const { serverOrigin, workspaceId } = deps.session;
  const input: RegistrationInput = {
    installId,
    platform: device.platform,
    appVersion,
    locale,
    timezone: timeZone,
    name,
    expoPushToken: expoToken,
  };
  const fingerprint = fingerprintOf({
    serverOrigin,
    workspaceId,
    installId,
    expoToken,
    locale,
    timeZone,
    appVersion,
    name,
  });
  return Object.freeze({ input, fingerprint, expoToken });
}

function recordOf({ deps }: Run, prepared: Prepared, deviceId: string, pushKey: string) {
  return Object.freeze({
    serverOrigin: deps.session.serverOrigin,
    workspaceId: deps.session.workspaceId,
    deviceId,
    pushKey,
    expoToken: prepared.expoToken,
    fingerprint: prepared.fingerprint,
    registeredAt: deps.now(),
    switchedOff: false,
  });
}

/** A key that is not this row's, or a minted one that could not be kept: the old record goes. */
async function forgetStale(store: PushKeyStore, facts: PushFacts): Promise<PushFacts> {
  try {
    await store.clear();
  } catch {
    logger.warn('[push] could not clear the stale push record');
  }
  return Object.freeze({ ...facts, record: null });
}

/** The server took the registration: keep the key it minted, or the one held for this row. */
async function settle(
  run: Run,
  facts: PushFacts,
  prepared: Prepared,
  answer: Registration,
): Promise<PushFacts> {
  const serverRow: ServerRow = Object.freeze({
    deviceId: answer.device_id,
    pushEnabled: null,
    disabledReason: null,
  });
  const base = Object.freeze({ ...facts, serverRow, lastConflict: null });
  const held = facts.record?.deviceId === answer.device_id ? facts.record.pushKey : null;
  const pushKey = answer.push_key ?? held;
  // no key for this row: recover_key (hosted) or key_missing (own); another row's key goes
  if (!pushKey) return facts.record ? forgetStale(run.deps.store, base) : base;
  const record = recordOf(run, prepared, answer.device_id, pushKey);
  if (await saved(run.deps, record)) return Object.freeze({ ...base, record });
  return answer.push_key ? forgetStale(run.deps.store, base) : base;
}

function refused(facts: PushFacts, error: unknown): PushFacts {
  const conflict = deviceConflictOf(error);
  if (conflict) {
    logger.warn('[push] the server refused the registration', { conflict });
    return Object.freeze({ ...facts, lastConflict: conflict });
  }
  logger.warn('[push] registration failed; it waits for the next try', { kind: kindOf(error) });
  return facts;
}

async function send(run: Run, facts: PushFacts, prepared: Prepared): Promise<PushFacts> {
  if (!isActive(run.deps)) return facts;
  let answer: Registration;
  try {
    answer = await registerDevice(run.deps.client, prepared.input);
  } catch (error) {
    return refused(facts, error);
  }
  return settle(run, facts, prepared, answer);
}

/**
 * A hosted phone's own row, revoked and registered again so W1 mints a key; at most once per
 * RECOVERY_MIN_INTERVAL_MS, noted before the DELETE so a crash mid-way cannot loop.
 */
async function recoverKey(run: Run, facts: PushFacts): Promise<PushFacts> {
  const { deps } = run;
  const row = facts.serverRow;
  const allowed = recoveryAllowed(deps.recoveries.lastAt(deps.session), deps.now());
  if (!row || !allowed || !isActive(deps)) return facts;
  deps.recoveries.note(deps.session, deps.now());
  try {
    await revokeDevice(deps.client, row.deviceId);
  } catch (error) {
    logger.warn('[push] could not revoke the row to recover its key', { kind: kindOf(error) });
    return facts;
  }
  // the row is revoked: the next trigger registers afresh if this one cannot
  const revoked = Object.freeze({ ...facts, serverRow: null });
  const prepared = await prepare(run, revoked);
  return prepared ? send(run, revoked, prepared) : revoked;
}

async function registerIfDue(run: Run, facts: PushFacts): Promise<PushFacts> {
  const prepared = await prepare(run, facts);
  if (!prepared) return facts;
  const due = run.force || isRegistrationDue(facts.record, prepared.fingerprint, run.deps.now());
  if (!due) return facts;
  const registered = await send(run, facts, prepared);
  return nextStep(registered) === 'recover_key' ? recoverKey(run, registered) : registered;
}

/** Push off at the OS: told to the server once (a gone row counts as told). */
async function switchOff(deps: RegisterDeps, facts: PushFacts): Promise<PushFacts> {
  const record = facts.record;
  if (!record || !isActive(deps)) return facts;
  try {
    await updateDevice(deps.client, record.deviceId, { push_enabled: false });
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'not_found') {
      logger.warn('[push] could not tell the server notifications are off', {
        kind: kindOf(error),
      });
      return facts;
    }
  }
  const next = Object.freeze({ ...record, switchedOff: true });
  return (await saved(deps, next)) ? Object.freeze({ ...facts, record: next }) : facts;
}

function runStep(step: NextStep, run: Run, facts: PushFacts): Promise<PushFacts> {
  if (step === 'switch_off') return switchOff(run.deps, facts);
  if (step === 'recover_key') return recoverKey(run, facts);
  if (step === 'register') return registerIfDue(run, facts);
  return Promise.resolve(facts);
}

export async function register(
  deps: RegisterDeps,
  memory: RegistrationMemory = NO_MEMORY,
  options: RegisterOptions = {},
): Promise<RegistrationOutcome> {
  const device = deps.device.read();
  const stored = await storedRecord(deps.store);
  const force = options.force === true;
  // a person's tap turns notifications back on after Remove this phone
  if (force && isActive(deps)) deps.hold.release(deps.session);
  const held = !force && deps.hold.held(deps.session);
  const facts: PushFacts = Object.freeze({
    capabilityPush: deps.session.capabilityPush,
    pushExpo: deps.session.pushExpo,
    source: deps.session.source,
    projectId: device.projectId,
    permission: await readPermission(deps.port),
    record: recordFor(stored ?? null, deps.session),
    // a removed phone's row is gone: the tap that turns it on registers afresh, never recovers
    serverRow: held ? null : memory.serverRow,
    lastConflict: force ? null : memory.lastConflict,
    held,
  });
  const step = stored === undefined ? 'none' : nextStep(facts);
  const after = await runStep(step, { deps, device, force }, facts);
  return Object.freeze({ step, status: pushStatus(after), facts: after });
}
