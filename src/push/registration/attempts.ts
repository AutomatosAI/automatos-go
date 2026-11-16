// A registration that went out and whose answer this phone never kept (KP10, US-014i): the POST
// reached the server, but its answer was lost to a timeout or a network that dropped after it was
// sent, or the app was killed while it was out. The server may then hold an active row for this
// phone, sending to its push token, that the phone has no id for. register.ts notes the attempt,
// per server and workspace, BEFORE each POST goes. The note is cleared only when that is settled: a
// push record kept for the scope (register.ts), a DELETE the server confirmed for the scope (the
// sign-out, bind/leave.ts, or Remove this phone), or a learn the server refused with a 409 (it holds
// no active row of this phone's). A hosted sign-out that has no other id for its row asks
// learnRowId, which learns it by registering again without the push token: POST
// /api/v1/mobile/devices upserts the caller's own row by install id, so its answer names this
// phone's row and no one else's, and a registration with no token leaves the row's push as it was;
// the leave then DELETEs that row. A DELETE that fails, or a learn cut off by the sign-out's time,
// leaves the note, so the next chance finishes the job: a second Sign out in this launch (the row
// is remembered), or, after a relaunch while still signed in, the next registration or the next
// Sign out (it learns again). The note lives in the encrypted store, which every way of leaving
// empties, or makes unreadable, once the provider has signed out (src/connect/switch.ts
// clearUserData): a note can only have been written in this signed-in session. Nothing is learned
// where nothing was noted, or where the person removed this phone. One MMKV item (KP18: scopes
// only, never a key, a token or an id): a JSON array of scope keys, the newest last, at most
// REGISTRATION_ATTEMPTS_MAX. A store that fails reads as none noted, and a failed write is logged.
// Never throws. Logs carry kinds only.

import { z } from 'zod';

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { registerDevice, type RegistrationInput } from '../api';
import { REGISTRATION_ATTEMPTS_ITEM, REGISTRATION_ATTEMPTS_MAX } from '../config';
import { deviceConflictOf } from '../schemas/server';
import type { DeviceSource } from './device-facts';
import { scopeKey, type RecordScope } from './record';
import type { RegistrationSession } from './register';
import type { RemovalHold } from './removal-hold';

export type RegistrationAttempts = Readonly<{
  /** A registration went out here, and no push record was kept for it since. */
  noted: (scope: RecordScope) => boolean;
  /** Before a POST goes. */
  note: (scope: RecordScope) => void;
  /** Settled: a push record kept here, a DELETE confirmed here, or a learn refused. */
  clear: (scope: RecordScope) => void;
}>;

type Scopes = readonly string[];

const StoredScopes = z.array(z.string());

function scopesOf(stored: string | null): Scopes {
  const parsed = StoredScopes.safeParse(stored ? parseJson(stored)?.value : undefined);
  return parsed.success ? parsed.data : [];
}

/** scopes with this one noted, the newest last, the oldest dropped past the maximum; a new array. */
export function withAttempt(scopes: Scopes, scope: RecordScope): Scopes {
  const key = scopeKey(scope);
  const others = scopes.filter((noted) => noted !== key);
  return Object.freeze([...others.slice(-(REGISTRATION_ATTEMPTS_MAX - 1)), key]);
}

export function registrationAttemptsOver(
  storage: Pick<KeyValueStorage, 'getItem' | 'setItem'>,
): RegistrationAttempts {
  const read = (): Scopes => {
    try {
      return scopesOf(storage.getItem(REGISTRATION_ATTEMPTS_ITEM));
    } catch {
      return [];
    }
  };
  const write = (scopes: Scopes) => {
    try {
      storage.setItem(REGISTRATION_ATTEMPTS_ITEM, JSON.stringify(scopes));
    } catch {
      logger.warn('[push] could not keep the registration attempts');
    }
  };
  return Object.freeze({
    noted: (scope: RecordScope) => read().includes(scopeKey(scope)),
    note: (scope: RecordScope) => write(withAttempt(read(), scope)),
    clear: (scope: RecordScope) => {
      const scopes = read();
      const key = scopeKey(scope);
      if (scopes.includes(key)) write(Object.freeze(scopes.filter((noted) => noted !== key)));
    },
  });
}

export type LearnDeps = Readonly<{
  session: RegistrationSession;
  client: ApiClient;
  device: Pick<DeviceSource, 'read'>;
  hold: Pick<RemovalHold, 'held'>;
  attempts: RegistrationAttempts;
}>;

async function installIdOf(session: RegistrationSession): Promise<string | null> {
  try {
    return await session.getInstallId();
  } catch {
    return null;
  }
}

/** This phone as a registration without the push token describes it; null while a fact is missing. */
async function tokenlessInput(deps: LearnDeps): Promise<RegistrationInput | null> {
  const { platform, appVersion, locale, timeZone, name } = deps.device.read();
  const installId = await installIdOf(deps.session);
  if (!installId || !appVersion || !locale || !timeZone) return null;
  return Object.freeze({ installId, platform, appVersion, locale, timezone: timeZone, name });
}

/**
 * This phone's row in the session's scope, where a registration's answer was lost and the person
 * has not removed this phone here; null otherwise, or when the server refuses or does not answer.
 */
export async function learnRowId(deps: LearnDeps, signal?: AbortSignal): Promise<string | null> {
  const scope = deps.session;
  if (!deps.attempts.noted(scope) || deps.hold.held(scope)) return null;
  const input = await tokenlessInput(deps);
  if (!input) return null;
  try {
    // the note stays until the DELETE of this row is confirmed (bind/leave.ts)
    return (await registerDevice(deps.client, input, signal)).device_id;
  } catch (error) {
    // a 409 changed nothing: the server holds no active row of this phone's to remove
    if (deviceConflictOf(error)) deps.attempts.clear(scope);
    logger.warn('[push] could not learn the row of a registration whose answer was lost', {
      kind: isApiError(error) ? error.kind : 'unknown',
    });
    return null;
  }
}
