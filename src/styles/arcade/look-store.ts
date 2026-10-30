// Arcade's looks on the phone (D-ARC-3): {saved, active} in the app's encrypted MMKV store, never
// the server's, as HUD's are (hud/look-store.ts, whose idiom this mirrors). Pure over the
// KeyValueStorage port, so it runs in vitest; the style provider hands it the foundation's store
// (src/storage/mmkv.ts appStorage). Every look read back goes through the vendored validateLook
// (isArcadeLook): an invalid saved look is dropped, an invalid active look is Overworld, and the
// phone keeps at most MAX_ARCADE_SAVED_LOOKS. A store that fails is logged: a failed read is
// Overworld with nothing saved, a failed write keeps the looks in memory for this launch.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import {
  INITIAL_ARCADE_LOOKS,
  MAX_ARCADE_SAVED_LOOKS,
  isPresetId,
  type ArcadeLooks,
} from './arcade-looks';
import { ARCADE_DEFAULT_LOOK, isArcadeLook, type ArcadeLook } from './look-schema';

/** The MMKV key (beside styles.hud.looks). */
export const ARCADE_LOOKS_KEY = 'styles.arcade.looks';

/** The stored shape's version; a value written under any other version reads as Overworld. */
export const ARCADE_LOOKS_VERSION = 1;

/** The envelope only: each look inside is checked by the vendored validateLook. */
const StoredLooksSchema = z.object({
  v: z.literal(ARCADE_LOOKS_VERSION),
  saved: z.array(z.unknown()).catch([]),
  active: z.unknown(),
});

export function serialiseArcadeLooks(looks: ArcadeLooks): string {
  return JSON.stringify({ v: ARCADE_LOOKS_VERSION, saved: looks.saved, active: looks.active });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The saved looks that pass: never a preset's id, each id once, at most MAX_ARCADE_SAVED_LOOKS. */
function savedLooks(stored: readonly unknown[]): readonly ArcadeLook[] {
  const kept = stored.reduce<readonly ArcadeLook[]>((looks, entry) => {
    if (!isArcadeLook(entry) || isPresetId(entry.id)) return looks;
    return looks.some((look) => look.id === entry.id) ? looks : [...looks, Object.freeze(entry)];
  }, []);
  return Object.freeze(kept.slice(0, MAX_ARCADE_SAVED_LOOKS));
}

/** The stored string back to Arcade's looks; unknown or invalid parts fall back, never a crash. */
export function parseArcadeLooks(raw: unknown): ArcadeLooks {
  if (typeof raw !== 'string') return INITIAL_ARCADE_LOOKS;
  const parsed = StoredLooksSchema.safeParse(parseJson(raw));
  if (!parsed.success) return INITIAL_ARCADE_LOOKS;
  const { saved, active } = parsed.data;
  return Object.freeze({
    saved: savedLooks(saved),
    active: isArcadeLook(active) ? Object.freeze(active) : ARCADE_DEFAULT_LOOK,
  });
}

export function readArcadeLooks(storage: KeyValueStorage): ArcadeLooks {
  try {
    return parseArcadeLooks(storage.getItem(ARCADE_LOOKS_KEY));
  } catch (error) {
    logger.warn('[styles] could not read the Arcade looks; using Overworld', error);
    return INITIAL_ARCADE_LOOKS;
  }
}

/** true when the looks were saved; false (logged) when the store refused them. */
export function saveArcadeLooks(storage: KeyValueStorage, looks: ArcadeLooks): boolean {
  try {
    storage.setItem(ARCADE_LOOKS_KEY, serialiseArcadeLooks(looks));
    return true;
  } catch (error) {
    logger.warn('[styles] could not save the Arcade looks; they apply until the app closes', error);
    return false;
  }
}

export type ArcadeLooksStore = {
  /** The looks in memory, read from the store the first time. */
  readonly get: () => ArcadeLooks;
  /** Holds the looks in memory and saves them; false when the save failed (logged). */
  readonly set: (looks: ArcadeLooks) => boolean;
};

/**
 * One set of Arcade looks per store. `storage` is called on the first read or write, so a caller
 * can pass the foundation's appStorage and nothing touches the keychain until Arcade needs its
 * looks. Looks are held as the next launch will read them back (one that fails validateLook is
 * dropped).
 */
export function createArcadeLooksStore(storage: () => KeyValueStorage): ArcadeLooksStore {
  let current: ArcadeLooks | null = null;

  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn('[styles] the Arcade looks store is unavailable', error);
      return null;
    }
  };

  return Object.freeze({
    get: () => {
      if (current === null) {
        const opened = open();
        current = opened ? readArcadeLooks(opened) : INITIAL_ARCADE_LOOKS;
      }
      return current;
    },
    set: (looks: ArcadeLooks) => {
      current = parseArcadeLooks(serialiseArcadeLooks(looks));
      const opened = open();
      return opened ? saveArcadeLooks(opened, current) : false;
    },
  });
}
