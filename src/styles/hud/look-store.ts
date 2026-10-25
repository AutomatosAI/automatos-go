// HUD's looks on the phone (D59): {saved, active} in the app's encrypted MMKV store, never the
// server's. Pure over the KeyValueStorage port, so it runs in vitest; the style provider hands it
// the foundation's store (src/storage/mmkv.ts appStorage), as registry/choice-store.ts does for
// the style choice, whose idiom this mirrors. Every look read back goes through the vendored
// validateLook (isHudLook): an invalid saved look is dropped, an invalid active look is ARC, and
// the phone keeps at most MAX_HUD_SAVED_LOOKS. A store that fails is logged: a failed read is ARC
// with nothing saved, a failed write keeps the looks in memory for this launch.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { INITIAL_HUD_LOOKS, MAX_HUD_SAVED_LOOKS, isPresetId, type HudLooks } from './hud-looks';
import { HUD_DEFAULT_LOOK, isHudLook, type HudLook } from './look-schema';

/** The MMKV key (beside styles.choice). */
export const HUD_LOOKS_KEY = 'styles.hud.looks';

/** The stored shape's version; a value written under any other version reads as ARC. */
export const HUD_LOOKS_VERSION = 1;

/** The envelope only: each look inside is checked by the vendored validateLook. */
const StoredLooksSchema = z.object({
  v: z.literal(HUD_LOOKS_VERSION),
  saved: z.array(z.unknown()).catch([]),
  active: z.unknown(),
});

export function serialiseHudLooks(looks: HudLooks): string {
  return JSON.stringify({ v: HUD_LOOKS_VERSION, saved: looks.saved, active: looks.active });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The saved looks that pass: never a preset's id, each id once, at most MAX_HUD_SAVED_LOOKS. */
function savedLooks(stored: readonly unknown[]): readonly HudLook[] {
  const kept = stored.reduce<readonly HudLook[]>((looks, entry) => {
    if (!isHudLook(entry) || isPresetId(entry.id)) return looks;
    return looks.some((look) => look.id === entry.id) ? looks : [...looks, Object.freeze(entry)];
  }, []);
  return Object.freeze(kept.slice(0, MAX_HUD_SAVED_LOOKS));
}

/** The stored string back to HUD's looks; unknown or invalid parts fall back, never a crash. */
export function parseHudLooks(raw: unknown): HudLooks {
  if (typeof raw !== 'string') return INITIAL_HUD_LOOKS;
  const parsed = StoredLooksSchema.safeParse(parseJson(raw));
  if (!parsed.success) return INITIAL_HUD_LOOKS;
  const { saved, active } = parsed.data;
  return Object.freeze({
    saved: savedLooks(saved),
    active: isHudLook(active) ? Object.freeze(active) : HUD_DEFAULT_LOOK,
  });
}

export function readHudLooks(storage: KeyValueStorage): HudLooks {
  try {
    return parseHudLooks(storage.getItem(HUD_LOOKS_KEY));
  } catch (error) {
    logger.warn('[styles] could not read the HUD looks; using ARC', error);
    return INITIAL_HUD_LOOKS;
  }
}

/** true when the looks were saved; false (logged) when the store refused them. */
export function saveHudLooks(storage: KeyValueStorage, looks: HudLooks): boolean {
  try {
    storage.setItem(HUD_LOOKS_KEY, serialiseHudLooks(looks));
    return true;
  } catch (error) {
    logger.warn('[styles] could not save the HUD looks; they apply until the app closes', error);
    return false;
  }
}

export type HudLooksStore = {
  /** The looks in memory, read from the store the first time. */
  readonly get: () => HudLooks;
  /** Holds the looks in memory and saves them; false when the save failed (logged). */
  readonly set: (looks: HudLooks) => boolean;
};

/**
 * One set of HUD looks per store. `storage` is called on the first read or write, so a caller can
 * pass the foundation's appStorage and nothing touches the keychain until HUD needs its looks.
 * Looks are held as the next launch will read them back (one that fails validateLook is dropped).
 */
export function createHudLooksStore(storage: () => KeyValueStorage): HudLooksStore {
  let current: HudLooks | null = null;

  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn('[styles] the HUD looks store is unavailable', error);
      return null;
    }
  };

  return Object.freeze({
    get: () => {
      if (current === null) {
        const opened = open();
        current = opened ? readHudLooks(opened) : INITIAL_HUD_LOOKS;
      }
      return current;
    },
    set: (looks: HudLooks) => {
      current = parseHudLooks(serialiseHudLooks(looks));
      const opened = open();
      return opened ? saveHudLooks(opened, current) : false;
    },
  });
}
