// When this phone last recovered its push key, per server and workspace (KP10): a hosted phone with
// no key for its row revokes the row and registers again — W1 mints a new key after a person's own
// revoke — at most once per RECOVERY_MIN_INTERVAL_MS for that row's server and workspace, so a
// keychain that keeps failing never revokes in a loop, and a recovery in one workspace never holds
// up another's. The log is one MMKV item (KP18: dates only, never a key or a token): a JSON object
// of scope → epoch milliseconds, at most RECOVERY_SCOPES_MAX, the oldest dropped. PushRoot passes
// appStorage() (src/storage/mmkv.ts). A store that fails reads as never, and a failed note is
// logged: the next launch may then try once more.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { KEY_RECOVERY_ITEM, RECOVERY_MIN_INTERVAL_MS, RECOVERY_SCOPES_MAX } from '../config';
import type { RecordScope } from './record';

export type RecoveryLog = Readonly<{
  lastAt: (scope: RecordScope) => number | null;
  note: (scope: RecordScope, at: number) => void;
}>;

type Times = Readonly<Record<string, number>>;

const StoredTimes = z.record(z.string(), z.number().int().nonnegative());

/** Never tried, a day or more ago, or a clock set back since: a recovery may run now. */
export function recoveryAllowed(lastAt: number | null, now: number): boolean {
  if (lastAt === null) return true;
  const since = now - lastAt;
  return since < 0 || since >= RECOVERY_MIN_INTERVAL_MS;
}

function scopeKey(scope: RecordScope): string {
  return JSON.stringify([scope.serverOrigin, scope.workspaceId]);
}

function timesOf(stored: string | null): Times {
  const parsed = StoredTimes.safeParse(stored ? parseJson(stored)?.value : undefined);
  return parsed.success ? parsed.data : {};
}

/** times with scope at `at`, the oldest dropped past RECOVERY_SCOPES_MAX; a new object. */
export function withRecovery(times: Times, scope: RecordScope, at: number): Times {
  const others = Object.entries(times).filter(([key]) => key !== scopeKey(scope));
  const kept = others.sort(([, a], [, b]) => b - a).slice(0, RECOVERY_SCOPES_MAX - 1);
  return Object.freeze(Object.fromEntries([...kept, [scopeKey(scope), at]]));
}

export function recoveryLogOver(
  storage: Pick<KeyValueStorage, 'getItem' | 'setItem'>,
): RecoveryLog {
  const read = (): Times => {
    try {
      return timesOf(storage.getItem(KEY_RECOVERY_ITEM));
    } catch {
      return {};
    }
  };
  return Object.freeze({
    lastAt: (scope: RecordScope) => read()[scopeKey(scope)] ?? null,
    note: (scope: RecordScope, at: number) => {
      try {
        storage.setItem(KEY_RECOVERY_ITEM, JSON.stringify(withRecovery(read(), scope, at)));
      } catch {
        logger.warn('[push] could not note the key recovery');
      }
    },
  });
}
