// Play's looks on the phone (D59, US-017d): {saved, active} in the app's encrypted MMKV store under
// 'styles.play.looks', read before the first frame so a phone on Play paints its look at once, and
// written to the style store (provider/store.ts) on every change. Pure over the KeyValueStorage
// port through themes/cache.ts storedPart, as the theme painting is. Every look read back goes
// through the vendored validateLook (looks-schemas.ts keptLooks): an invalid saved look is dropped,
// an invalid active look is Ember, and the phone keeps at most MAX_SAVED_LOOKS. A failing store is
// logged: a failed read is Ember with nothing saved, a failed write keeps the looks for this launch.

import { z } from 'zod';

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { storedPart, type StoredPart } from '../themes/cache';
import { keptLooks } from './looks-schemas';
import { INITIAL_PLAY_LOOKS, PLAY_LOOK_RULES, checkPlayLook, type PlayLooks } from './play-looks';

/** The MMKV key (beside styles.hud.looks). */
export const PLAY_LOOKS_KEY = 'styles.play.looks';

/** The stored shape's version; a value written under any other version reads as Ember. */
export const PLAY_LOOKS_VERSION = 1;

/** The envelope only: each look inside is checked by the vendored validateLook. */
const StoredLooksSchema = z.object({
  v: z.literal(PLAY_LOOKS_VERSION),
  saved: z.array(z.unknown()).catch([]),
  active: z.unknown(),
});

export function serialisePlayLooks(looks: PlayLooks): string {
  return JSON.stringify({ v: PLAY_LOOKS_VERSION, saved: looks.saved, active: looks.active });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The stored string back to Play's looks; unknown or invalid parts fall back, never a crash. */
export function parsePlayLooks(raw: unknown): PlayLooks {
  if (typeof raw !== 'string') return INITIAL_PLAY_LOOKS;
  const parsed = StoredLooksSchema.safeParse(parseJson(raw));
  if (!parsed.success) return INITIAL_PLAY_LOOKS;
  return Object.freeze({
    saved: keptLooks(PLAY_LOOK_RULES, parsed.data.saved).looks,
    active: checkPlayLook(parsed.data.active) ?? INITIAL_PLAY_LOOKS.active,
  });
}

/**
 * The phone's Play looks, opened on the first read (nothing touches the keychain before then) and
 * held as the next launch will read them back.
 */
export function createPlayLooksStore(storage: () => KeyValueStorage): StoredPart<PlayLooks> {
  return storedPart(storage, {
    key: PLAY_LOOKS_KEY,
    what: 'Play looks',
    fallback: INITIAL_PLAY_LOOKS,
    serialise: serialisePlayLooks,
    parse: parsePlayLooks,
  });
}
