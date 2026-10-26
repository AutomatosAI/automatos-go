// The person's Remove this phone (KP16), per server and workspace: W1 re-enrols a row its own
// person revoked, so without this hold the next launch, resume or new token would register the
// phone again on its own. While a scope is held, registration takes no step and answers 'ask'
// (register.ts); a person's tap — 'Turn on notifications', a forced run — releases it. One MMKV
// item (KP18: scopes only, never a key or a token): a JSON array of scope keys, the newest last, at
// most REMOVED_SCOPES_MAX, the oldest dropped. A store that fails reads as not held (as the
// recovery log reads as never), and a failed write is logged.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { REMOVED_SCOPES_ITEM, REMOVED_SCOPES_MAX } from '../config';
import { scopeKey, type RecordScope } from './record';

export type RemovalHold = Readonly<{
  held: (scope: RecordScope) => boolean;
  /** Remove this phone: nothing registers in this scope until the person's tap. */
  hold: (scope: RecordScope) => void;
  /** The person's tap: registration runs again. */
  release: (scope: RecordScope) => void;
}>;

type Scopes = readonly string[];

const StoredScopes = z.array(z.string());

function scopesOf(stored: string | null): Scopes {
  const parsed = StoredScopes.safeParse(stored ? parseJson(stored)?.value : undefined);
  return parsed.success ? parsed.data : [];
}

/** scopes with this one held, the newest last, the oldest dropped past REMOVED_SCOPES_MAX. */
export function withHeld(scopes: Scopes, scope: RecordScope): Scopes {
  const key = scopeKey(scope);
  const others = scopes.filter((held) => held !== key);
  return Object.freeze([...others.slice(-(REMOVED_SCOPES_MAX - 1)), key]);
}

/** scopes without this one; a new array. */
export function withoutHeld(scopes: Scopes, scope: RecordScope): Scopes {
  const key = scopeKey(scope);
  return Object.freeze(scopes.filter((held) => held !== key));
}

export function removalHoldOver(
  storage: Pick<KeyValueStorage, 'getItem' | 'setItem'>,
): RemovalHold {
  const read = (): Scopes => {
    try {
      return scopesOf(storage.getItem(REMOVED_SCOPES_ITEM));
    } catch {
      return [];
    }
  };
  const write = (scopes: Scopes, what: string) => {
    try {
      storage.setItem(REMOVED_SCOPES_ITEM, JSON.stringify(scopes));
    } catch {
      logger.warn(`[push] could not ${what} the removal hold`);
    }
  };
  return Object.freeze({
    held: (scope: RecordScope) => read().includes(scopeKey(scope)),
    hold: (scope: RecordScope) => write(withHeld(read(), scope), 'keep'),
    release: (scope: RecordScope) => {
      const scopes = read();
      if (scopes.includes(scopeKey(scope))) write(withoutHeld(scopes, scope), 'release');
    },
  });
}
