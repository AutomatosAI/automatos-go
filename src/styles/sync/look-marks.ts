// The look sync's marks on the phone (US-017d): per theme, whether the phone has met the server's
// copy (serverSeen) and which part was changed on the phone and not kept by the server yet
// (lookChanged, savedChanged), so a change made offline is still sent after the app is closed and
// opened again, and the first meeting merges once. Beside each theme's looks in the app's encrypted
// MMKV store (styles.play.looks.sync, styles.hud.looks.sync), through themes/cache.ts storedPart.
// Pure over the KeyValueStorage port; anything that does not fit reads as no marks.

import { z } from 'zod';

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { NO_MARKS, type LookMarks } from '../play/look-sync';
import { storedPart, type StoredPart } from '../themes/cache';

/** The themes whose looks the phone keeps in step with the web. */
export const LOOK_THEME_KEYS = Object.freeze(['play', 'hud'] as const);
export type LookThemeKey = (typeof LOOK_THEME_KEYS)[number];

export const LOOK_MARKS_KEYS: Readonly<Record<LookThemeKey, string>> = Object.freeze({
  play: 'styles.play.looks.sync',
  hud: 'styles.hud.looks.sync',
});

/** The stored shape's version; a value written under any other version reads as no marks. */
export const LOOK_MARKS_VERSION = 1;

const StoredMarksSchema = z.object({
  v: z.literal(LOOK_MARKS_VERSION),
  serverSeen: z.boolean(),
  lookChanged: z.boolean(),
  savedChanged: z.boolean(),
});

export function serialiseLookMarks(marks: LookMarks): string {
  const { serverSeen, lookChanged, savedChanged } = marks;
  return JSON.stringify({ v: LOOK_MARKS_VERSION, serverSeen, lookChanged, savedChanged });
}

export function parseLookMarks(raw: unknown): LookMarks {
  if (typeof raw !== 'string') return NO_MARKS;
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return NO_MARKS;
  }
  const parsed = StoredMarksSchema.safeParse(json);
  if (!parsed.success) return NO_MARKS;
  const { serverSeen, lookChanged, savedChanged } = parsed.data;
  return Object.freeze({ serverSeen, lookChanged, savedChanged });
}

export type LookMarksParts = Readonly<Record<LookThemeKey, StoredPart<LookMarks>>>;

/** Each theme's marks, opened lazily on the first read. */
export function lookMarksParts(storage: () => KeyValueStorage): LookMarksParts {
  const part = (key: LookThemeKey) =>
    storedPart(storage, {
      key: LOOK_MARKS_KEYS[key],
      what: `${key} look sync marks`,
      fallback: NO_MARKS,
      serialise: serialiseLookMarks,
      parse: parseLookMarks,
    });
  return Object.freeze({ play: part('play'), hud: part('hud') });
}
