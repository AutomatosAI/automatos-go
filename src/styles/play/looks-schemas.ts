// The looks routes' shapes (D-ONE-CLIENT: zod at the boundary, unknown fields ignored), pure. The
// answer of GET and PUT /api/themes/looks/{themeId} (services/themes/looks.py looks_response) is
// read whole by zod, then each look goes through the theme's own check (the vendored validateLook):
// an invalid look, a saved look under a preset's id and a second look with an id already kept are
// dropped and counted, never a crash. A PUT body carries both fields every time (the server's
// BODY_SHAPE: a save replaces the whole list) and at most MAX_SAVED_LOOKS saved looks.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import type { LookDoc, LookRules, LookSet, ServedSet } from './look-sync';

/** The most saved looks the server keeps per member and theme (looks.py MAX_SAVED_LOOKS). */
export const MAX_SAVED_LOOKS = 100;

/** {themeId, looks, active, defaultLook, dropped}; a look's own fields are the theme's check's. */
export const LooksAnswerSchema = z.object({
  themeId: z.string(),
  looks: z.array(z.unknown()),
  active: z.unknown(),
  // looks.py answers null for an installed theme with neither a manifest look nor a preset
  defaultLook: z.string().nullable().catch(null),
  dropped: z.number().int().nonnegative().catch(0),
});
export type LooksAnswer = z.infer<typeof LooksAnswerSchema>;

/** The server's copy as the phone takes it, with every look it could not take counted. */
export type ServedLooks<L extends LookDoc> = ServedSet<L> & {
  readonly themeId: string;
  readonly defaultLook: string | null;
  /** Left out by the server (looks.py carry_looks) plus left out here. */
  readonly dropped: number;
};

/** What a PUT sends: both fields, every time. */
export type LooksBody = {
  readonly looks: readonly Readonly<Record<string, unknown>>[];
  readonly active: Readonly<Record<string, unknown>> | null;
};

export type KeptLooks<L extends LookDoc> = {
  readonly looks: readonly L[];
  readonly dropped: number;
};

/** The saved looks the theme takes: checked, never a preset's id, each id once, at most 100. */
export function keptLooks<L extends LookDoc>(
  rules: LookRules<L>,
  entries: readonly unknown[],
): KeptLooks<L> {
  const looks = entries.reduce<readonly L[]>((kept, entry) => {
    const look = rules.check(entry);
    if (look === null || rules.isPreset(look.id)) return kept;
    return kept.some((other) => other.id === look.id) ? kept : [...kept, Object.freeze(look)];
  }, []);
  const capped = Object.freeze(looks.slice(0, MAX_SAVED_LOOKS));
  return { looks: capped, dropped: entries.length - capped.length };
}

/** The active look the theme takes, or null (none, or not one it takes). */
function activeLook<L extends LookDoc>(rules: LookRules<L>, value: unknown) {
  if (value === null || value === undefined) return { look: null, dropped: 0 };
  const look = rules.check(value);
  return look === null ? { look: null, dropped: 1 } : { look: Object.freeze(look), dropped: 0 };
}

/** The answer's looks through the theme's check; what the server or the check left out is logged. */
export function servedLooks<L extends LookDoc>(
  rules: LookRules<L>,
  answer: LooksAnswer,
): ServedLooks<L> {
  const saved = keptLooks(rules, answer.looks);
  const active = activeLook(rules, answer.active);
  const dropped = answer.dropped + saved.dropped + active.dropped;
  if (dropped > 0) {
    logger.warn(`[styles] ${dropped} ${rules.themeId} look(s) could not be read; left out`);
  }
  return Object.freeze({
    themeId: answer.themeId,
    defaultLook: answer.defaultLook,
    saved: saved.looks,
    active: active.look,
    dropped,
  });
}

/** The PUT body for the phone's copy: both fields, fresh objects, at most MAX_SAVED_LOOKS. */
export function lookBody<L extends LookDoc>(set: LookSet<L> | ServedSet<L>): LooksBody {
  const looks = set.saved.slice(0, MAX_SAVED_LOOKS).map((look) => ({ ...look }));
  return { looks, active: set.active === null ? null : { ...set.active } };
}
