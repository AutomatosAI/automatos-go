// A Remove this phone the server has not confirmed (KP16): its DELETE failed with something other
// than "already gone" (no network, a refusal, no answer). The phone still clears its push record,
// so the row's id is kept here, per server and workspace, until the removal is finished: the next
// tap on Remove this phone (the button stays offered while a removal is owed), the next launch
// while the person's hold stands (PushRoot), or the next Sign out, each DELETEs it, and a removal
// the server confirms, or answers 404 to, settles it. A person who turned notifications on again
// since (the hold released) owes nothing: the next launch settles it unsent. One MMKV item (KP18:
// ids, never a key or a token): a JSON object of scope key → row id, at most REMOVALS_OWED_MAX, the
// oldest dropped. A store that fails reads as nothing owed, and a failed write is logged.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { REMOVALS_OWED_ITEM, REMOVALS_OWED_MAX, UUID_PATTERN } from '../config';
import { scopeKey, type RecordScope } from './record';

export type RemovalOwed = Readonly<{
  /** The row whose removal the server has not confirmed here; null when none is owed. */
  owed: (scope: RecordScope) => string | null;
  owe: (scope: RecordScope, deviceId: string) => void;
  /** Confirmed (or 404), or no longer wanted: nothing is owed here. */
  settle: (scope: RecordScope) => void;
}>;

type Owed = Readonly<Record<string, string>>;

const StoredOwed = z.record(z.string(), z.string().regex(UUID_PATTERN));

function owedOf(stored: string | null): Owed {
  const parsed = StoredOwed.safeParse(stored ? parseJson(stored)?.value : undefined);
  return parsed.success ? parsed.data : {};
}

/** owed with this scope's row, the newest last, the oldest dropped past the maximum; a new object. */
export function withOwed(owed: Owed, scope: RecordScope, deviceId: string): Owed {
  const key = scopeKey(scope);
  const others = Object.entries(owed).filter(([held]) => held !== key);
  return Object.freeze(
    Object.fromEntries([...others.slice(-(REMOVALS_OWED_MAX - 1)), [key, deviceId]]),
  );
}

export function removalOwedOver(
  storage: Pick<KeyValueStorage, 'getItem' | 'setItem'>,
): RemovalOwed {
  const read = (): Owed => {
    try {
      return owedOf(storage.getItem(REMOVALS_OWED_ITEM));
    } catch {
      return {};
    }
  };
  const write = (owed: Owed) => {
    try {
      storage.setItem(REMOVALS_OWED_ITEM, JSON.stringify(owed));
    } catch {
      logger.warn('[push] could not keep the removal owed');
    }
  };
  return Object.freeze({
    owed: (scope: RecordScope) => read()[scopeKey(scope)] ?? null,
    owe: (scope: RecordScope, deviceId: string) => write(withOwed(read(), scope, deviceId)),
    settle: (scope: RecordScope) => {
      const owed = read();
      const key = scopeKey(scope);
      if (key in owed) {
        write(Object.freeze(Object.fromEntries(Object.entries(owed).filter(([k]) => k !== key))));
      }
    },
  });
}
