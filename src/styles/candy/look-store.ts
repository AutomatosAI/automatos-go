// Candy's looks on the phone (D-CAN-3): {saved, active} in the app's encrypted MMKV store, never
// the server's, as Arcade's are (arcade/look-store.ts, whose idiom this mirrors). Pure over the
// KeyValueStorage port, so it runs in vitest; the style provider hands it the foundation's store
// (src/storage/mmkv.ts appStorage). Every look read back goes through the vendored validateLook
// (isCandyLook): an invalid saved look is dropped, an invalid active look is Blush, and the
// phone keeps at most MAX_CANDY_SAVED_LOOKS. A store that fails is logged: a failed read is
// Blush with nothing saved, a failed write keeps the looks in memory for this launch.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import {
  INITIAL_CANDY_LOOKS,
  MAX_CANDY_SAVED_LOOKS,
  isPresetId,
  type CandyLooks,
} from './candy-looks';
import { CANDY_DEFAULT_LOOK, isCandyLook, type CandyLook } from './look-schema';

/** The MMKV key (beside styles.arcade.looks). */
export const CANDY_LOOKS_KEY = 'styles.candy.looks';

/** The stored shape's version; a value written under any other version reads as Blush. */
export const CANDY_LOOKS_VERSION = 1;

/** The envelope only: each look inside is checked by the vendored validateLook. */
const StoredLooksSchema = z.object({
  v: z.literal(CANDY_LOOKS_VERSION),
  saved: z.array(z.unknown()).catch([]),
  active: z.unknown(),
});

export function serialiseCandyLooks(looks: CandyLooks): string {
  return JSON.stringify({ v: CANDY_LOOKS_VERSION, saved: looks.saved, active: looks.active });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The saved looks that pass: never a preset's id, each id once, at most MAX_CANDY_SAVED_LOOKS. */
function savedLooks(stored: readonly unknown[]): readonly CandyLook[] {
  const kept = stored.reduce<readonly CandyLook[]>((looks, entry) => {
    if (!isCandyLook(entry) || isPresetId(entry.id)) return looks;
    return looks.some((look) => look.id === entry.id) ? looks : [...looks, Object.freeze(entry)];
  }, []);
  return Object.freeze(kept.slice(0, MAX_CANDY_SAVED_LOOKS));
}

/** The stored string back to Candy's looks; unknown or invalid parts fall back, never a crash. */
export function parseCandyLooks(raw: unknown): CandyLooks {
  if (typeof raw !== 'string') return INITIAL_CANDY_LOOKS;
  const parsed = StoredLooksSchema.safeParse(parseJson(raw));
  if (!parsed.success) return INITIAL_CANDY_LOOKS;
  const { saved, active } = parsed.data;
  return Object.freeze({
    saved: savedLooks(saved),
    active: isCandyLook(active) ? Object.freeze(active) : CANDY_DEFAULT_LOOK,
  });
}

export function readCandyLooks(storage: KeyValueStorage): CandyLooks {
  try {
    return parseCandyLooks(storage.getItem(CANDY_LOOKS_KEY));
  } catch (error) {
    logger.warn('[styles] could not read the Candy looks; using Blush', error);
    return INITIAL_CANDY_LOOKS;
  }
}

/** true when the looks were saved; false (logged) when the store refused them. */
export function saveCandyLooks(storage: KeyValueStorage, looks: CandyLooks): boolean {
  try {
    storage.setItem(CANDY_LOOKS_KEY, serialiseCandyLooks(looks));
    return true;
  } catch (error) {
    logger.warn('[styles] could not save the Candy looks; they apply until the app closes', error);
    return false;
  }
}

export type CandyLooksStore = {
  /** The looks in memory, read from the store the first time. */
  readonly get: () => CandyLooks;
  /** Holds the looks in memory and saves them; false when the save failed (logged). */
  readonly set: (looks: CandyLooks) => boolean;
};

/**
 * One set of Candy looks per store. `storage` is called on the first read or write, so a caller
 * can pass the foundation's appStorage and nothing touches the keychain until Candy needs its
 * looks. Looks are held as the next launch will read them back (one that fails validateLook is
 * dropped).
 */
export function createCandyLooksStore(storage: () => KeyValueStorage): CandyLooksStore {
  let current: CandyLooks | null = null;

  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn('[styles] the Candy looks store is unavailable', error);
      return null;
    }
  };

  return Object.freeze({
    get: () => {
      if (current === null) {
        const opened = open();
        current = opened ? readCandyLooks(opened) : INITIAL_CANDY_LOOKS;
      }
      return current;
    },
    set: (looks: CandyLooks) => {
      current = parseCandyLooks(serialiseCandyLooks(looks));
      const opened = open();
      return opened ? saveCandyLooks(opened, current) : false;
    },
  });
}
