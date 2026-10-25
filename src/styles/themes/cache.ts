// The last theme answers on the phone, for the first frame (D59, US-016i): what 'Same as Studio'
// painted (styles.theme.followed) and the painting of the theme last painted (styles.theme.paint),
// in the app's encrypted MMKV store, so a phone that follows a theme opens on it before any read.
// Pure over the KeyValueStorage port, as registry/choice-store.ts and hud/look-store.ts are, and
// opened lazily on the first read. Each value read back is checked again: a followed style through
// parseChoice (garbage is Studio), a painting through its schema, every colour #RRGGBB(AA) under
// each of Studio's names and every file URL through the allowlist (file-url.ts). Anything that
// does not fit is no painting (Studio). A failing store is logged, never thrown.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { InstallIdSchema, parseChoice, serialiseChoice } from '../registry/choice';
import { DEFAULT_CHOICE } from '../registry/registry';
import type { StyleChoice } from '../registry/style-id';
import { STUDIO_COLOURS } from '../tokens/studio';
import type { ColourName, Colours } from '../tokens/types';
import { themeFile, type ThemeFileKind } from './file-url';
import type { ThemePaint } from './types';

export const THEME_FOLLOWED_KEY = 'styles.theme.followed';
export const THEME_PAINT_KEY = 'styles.theme.paint';
/** The stored painting's version; a value written under any other version is no painting. */
export const THEME_PAINT_VERSION = 1;

/** A part kept in the store: read once, then held; set returns false when it was not saved. */
export type StoredPart<Value> = {
  readonly get: () => Value;
  readonly set: (value: Value) => boolean;
};

type PartSpec<Value> = {
  readonly key: string;
  readonly what: string;
  readonly fallback: Value;
  readonly serialise: (value: Value) => string;
  readonly parse: (raw: unknown) => Value;
};

/** One part per key: held as the next launch will read it back; a failing store is logged. */
export function storedPart<Value>(
  storage: () => KeyValueStorage,
  spec: PartSpec<Value>,
): StoredPart<Value> {
  let current: { readonly value: Value } | null = null;
  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn(`[styles] the ${spec.what} store is unavailable`, error);
      return null;
    }
  };
  const read = (): Value => {
    try {
      const opened = open();
      return opened ? spec.parse(opened.getItem(spec.key)) : spec.fallback;
    } catch (error) {
      logger.warn(`[styles] could not read the ${spec.what}`, error);
      return spec.fallback;
    }
  };
  const save = (value: Value): boolean => {
    try {
      const opened = open();
      opened?.setItem(spec.key, spec.serialise(value));
      return opened !== null;
    } catch (error) {
      logger.warn(
        `[styles] could not save the ${spec.what}; it applies until the app closes`,
        error,
      );
      return false;
    }
  };
  return Object.freeze({
    get: () => {
      current ??= { value: read() };
      return current.value;
    },
    set: (value: Value) => {
      current = { value: spec.parse(spec.serialise(value)) };
      return save(current.value);
    },
  });
}

const COLOUR_NAMES = Object.keys(STUDIO_COLOURS.light) as ColourName[];
const ColourValue = z.string().regex(/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/);
const ColoursSchema = z
  .object(Object.fromEntries(COLOUR_NAMES.map((name) => [name, ColourValue])))
  .transform((colours) => Object.freeze(colours) as Colours);

const fileUrl = (kind: ThemeFileKind) =>
  z.string().refine((url) => themeFile(url, kind) !== null, 'not an allowed theme file URL');

const ThemePaintSchema = z.object({
  installId: InstallIdSchema,
  colours: z.object({ light: ColoursSchema, dark: ColoursSchema }),
  tone: z.enum(['light', 'dark']).nullable(),
  mascot: z.boolean(),
  fonts: z
    .object({
      sans: fileUrl('font').optional(),
      serif: fileUrl('font').optional(),
      mono: fileUrl('font').optional(),
    })
    .optional(),
  mascotFiles: z
    .object({
      mode: z.enum(['clips', 'stills']),
      states: z.array(
        z.object({
          name: z.string().min(1),
          clip: fileUrl('mascot').nullable(),
          still: fileUrl('mascot').nullable(),
        }),
      ),
    })
    .nullable()
    .optional(),
});

const StoredPaintSchema = z.object({ v: z.literal(THEME_PAINT_VERSION), paint: z.unknown() });

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function serialiseThemePaint(paint: ThemePaint | null): string {
  return JSON.stringify({ v: THEME_PAINT_VERSION, paint });
}

/** The stored painting back, checked whole; anything that does not fit is no painting. */
export function parseThemePaint(raw: unknown): ThemePaint | null {
  if (typeof raw !== 'string') return null;
  const stored = StoredPaintSchema.safeParse(parseJson(raw));
  if (!stored.success || stored.data.paint === null) return null;
  const paint = ThemePaintSchema.safeParse(stored.data.paint);
  if (!paint.success) return null;
  const { colours, ...rest } = paint.data;
  return Object.freeze({ ...rest, colours: Object.freeze(colours) });
}

export function themeFollowedPart(storage: () => KeyValueStorage): StoredPart<StyleChoice> {
  return storedPart(storage, {
    key: THEME_FOLLOWED_KEY,
    what: "style 'Same as Studio' paints",
    fallback: DEFAULT_CHOICE,
    serialise: serialiseChoice,
    parse: parseChoice,
  });
}

export function themePaintPart(storage: () => KeyValueStorage): StoredPart<ThemePaint | null> {
  return storedPart<ThemePaint | null>(storage, {
    key: THEME_PAINT_KEY,
    what: 'theme painting',
    fallback: null,
    serialise: serialiseThemePaint,
    parse: parseThemePaint,
  });
}
