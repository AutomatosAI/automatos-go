// Candy's look rules, pure (US-023c; Make it sweet, US-023m, calls them): one choice knob changed,
// Glow set, a preset or saved look picked, Save look, rename, delete and Reset. Arcade's rules are
// the model (arcade/arcade-looks.ts); the behaviour is the design kit's at 3920359d5 (themes/candy/
// src/looks/spec.ts), ported, not vendored: a saved look is 'mine-N' / 'My look N' with the line
// 'From <the look it came from>', N counting on from the saved looks (freshNumber); Glow is clamped
// and rounded to the schema's range (clampKnob); the Roundness slider's position is its choice key
// (sliderKey); Reset is the palette's preset as it ships (resetOf); deleting the active look goes
// back to Blush. No server here: CANDY_LOOK_RULES hands the look sync (play/look-sync.ts) Candy's
// check and fresh-id rule, and it keeps the looks in step with the web under 'automatos/candy'
// where Candy is installed in the workspace (else they stay on the phone, with words, D-CAN-3).

import { LOOK_TEXT_MAX } from '../../core/web/lib/look-kit/validate';
import { plainTextProblem } from '../../core/web/lib/theme-host/css-value';
import type { LookRules } from '../play/look-sync';
import { nearestRadius } from '../tokens/candy';
import {
  CANDY_DEFAULT_LOOK,
  CANDY_PRESET_LOOKS,
  candyChoiceSpec,
  candyNumberSpec,
  isCandyLook,
  type CandyChoiceKnob,
  type CandyLook,
  type CandyNumberKnob,
} from './look-schema';
import { CANDY_LOOK_COPY } from './strings';

/** The id Candy's looks are kept under on the server (the web theme automatos/candy). */
export const CANDY_THEME_ID = 'automatos/candy';

/** The most looks a phone keeps: the server's cap per member and theme. */
export const MAX_CANDY_SAVED_LOOKS = 100;

/** A saved look's id is 'mine-N' (a vendored LOOK_ID_PATTERN id; spec.ts SAVED_ID_PREFIX). */
export const CANDY_SAVED_ID_PREFIX = 'mine-';

/** The phone's Candy looks: the ones the user saved, and the one Candy paints. */
export type CandyLooks = {
  readonly saved: readonly CandyLook[];
  readonly active: CandyLook;
};

export const INITIAL_CANDY_LOOKS: CandyLooks = Object.freeze({
  saved: Object.freeze([]),
  active: CANDY_DEFAULT_LOOK,
});

/** Why a change was refused: a preset is never renamed or deleted; a full phone saves no more. */
export type CandyLooksRefusal = 'preset' | 'not-saved' | 'full' | 'name';

export type CandyLooksChange =
  | { readonly ok: true; readonly looks: CandyLooks }
  | { readonly ok: false; readonly reason: CandyLooksRefusal };

function changed(looks: CandyLooks): CandyLooksChange {
  return { ok: true, looks: Object.freeze(looks) };
}

function refused(reason: CandyLooksRefusal): CandyLooksChange {
  return { ok: false, reason };
}

/** The preset, else the saved look, with this id. */
function findLook(saved: readonly CandyLook[], id: string): CandyLook | undefined {
  return CANDY_PRESET_LOOKS.find((look) => look.id === id) ?? saved.find((look) => look.id === id);
}

export function isPresetId(id: string): boolean {
  return CANDY_PRESET_LOOKS.some((look) => look.id === id);
}

/** The active look as `active`, the same object when nothing changed. */
function withActive(looks: CandyLooks, active: CandyLook): CandyLooks {
  return active === looks.active ? looks : Object.freeze({ ...looks, active });
}

/**
 * A copy of the look with one choice knob changed (spec.ts withValue: still the same look, edited),
 * only to one of the knob's choices; a value the knob cannot take returns `look` itself.
 */
export function withValue(look: CandyLook, knob: CandyChoiceKnob, value: string): CandyLook {
  if (!candyChoiceSpec(knob).choices.includes(value) || look[knob] === value) return look;
  return Object.freeze({ ...look, [knob]: value });
}

/** The active look with one choice knob changed (withValue). */
export function setKnob(looks: CandyLooks, knob: CandyChoiceKnob, value: string): CandyLooks {
  return withActive(looks, withValue(looks.active, knob, value));
}

/** spec.ts clampKnob: within the schema's min and max, whole; the knob's default when not a number. */
export function clampKnob(knob: CandyNumberKnob, value: number): number {
  const spec = candyNumberSpec(knob);
  if (!Number.isFinite(value)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}

/** The active look with a number knob (Glow) set, clamped and rounded (clampKnob). */
export function setNumber(looks: CandyLooks, knob: CandyNumberKnob, value: number): CandyLooks {
  const next = clampKnob(knob, value);
  if (next === looks.active[knob]) return looks;
  return withActive(looks, Object.freeze({ ...looks.active, [knob]: next }));
}

/**
 * spec.ts sliderKey: the Roundness slider's position as its choice key, clamped to '16'–'40' and
 * whole ('28' when not a number), for setKnob(looks, 'roundness', …).
 */
export function sliderKey(value: number): string {
  return String(nearestRadius(value));
}

/** A preset or saved look made the active one, as it was saved; an unknown id changes nothing. */
export function pickLook(looks: CandyLooks, id: string): CandyLooks {
  const picked = findLook(looks.saved, id);
  return picked === undefined ? looks : withActive(looks, picked);
}

/** spec.ts freshNumber: from one past the count of `taken`, the first N no look has as 'mine-N'. */
function freshNumber(taken: readonly CandyLook[]): number {
  const ids = new Set([...CANDY_PRESET_LOOKS, ...taken].map((look) => look.id));
  let n = taken.length + 1;
  while (ids.has(`${CANDY_SAVED_ID_PREFIX}${n}`)) n += 1;
  return n;
}

/** 'mine-N' as Save look numbers it, an id no preset and no look in `taken` uses. */
export function freshCandyLookId(taken: readonly CandyLook[]): string {
  return `${CANDY_SAVED_ID_PREFIX}${freshNumber(taken)}`;
}

/** 'From <name>' (spec.ts asNewLook), or no line when that is longer than a look's text may be. */
function savedSub(name: string): string {
  const sub = CANDY_LOOK_COPY.savedSub(name);
  return plainTextProblem(sub, 'sub', LOOK_TEXT_MAX) === null ? sub : '';
}

/**
 * 'Save look' (spec.ts asNewLook): the active values as 'mine-N' / 'My look N' with the line
 * 'From <the active look's name>', saved and made the active look. A phone holding
 * MAX_CANDY_SAVED_LOOKS saves no more.
 */
export function saveAsNew(looks: CandyLooks): CandyLooksChange {
  if (looks.saved.length >= MAX_CANDY_SAVED_LOOKS) return refused('full');
  const n = freshNumber(looks.saved);
  const { active } = looks;
  const look: CandyLook = Object.freeze({
    ...active,
    id: `${CANDY_SAVED_ID_PREFIX}${n}`,
    name: CANDY_LOOK_COPY.savedName(n),
    sub: savedSub(active.name),
  });
  return changed({ saved: Object.freeze([...looks.saved, look]), active: look });
}

/** Why a saved look's id cannot be renamed or deleted, or null when it can. */
function savedProblem(looks: CandyLooks, id: string): CandyLooksRefusal | null {
  if (isPresetId(id)) return 'preset';
  return looks.saved.some((look) => look.id === id) ? null : 'not-saved';
}

/**
 * A saved look renamed: the name trimmed, then 1 to 40 characters of one line of plain text (the
 * vendored rule). A preset keeps its name. Renaming the active look renames what Candy paints too.
 */
export function renameLook(looks: CandyLooks, id: string, name: string): CandyLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const trimmed = name.trim();
  if (plainTextProblem(trimmed, 'name', LOOK_TEXT_MAX) !== null) return refused('name');
  const rename = (look: CandyLook): CandyLook =>
    look.id === id ? Object.freeze({ ...look, name: trimmed }) : look;
  return changed({ saved: Object.freeze(looks.saved.map(rename)), active: rename(looks.active) });
}

/** A saved look deleted; a preset never is. Deleting the active look puts Candy on Blush. */
export function deleteLook(looks: CandyLooks, id: string): CandyLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const saved = Object.freeze(looks.saved.filter((look) => look.id !== id));
  return changed({ saved, active: looks.active.id === id ? CANDY_DEFAULT_LOOK : looks.active });
}

/** Reset (spec.ts resetOf): the active palette's preset as it ships; its saved looks stay. */
export function resetLook(looks: CandyLooks): CandyLooks {
  const { palette } = looks.active;
  const ofPalette = CANDY_PRESET_LOOKS.find((look) => look.palette === palette);
  return withActive(looks, ofPalette ?? CANDY_DEFAULT_LOOK);
}

/** A look as Candy takes it (the vendored validateLook over CANDY_LOOK_SPEC), or null. */
function checkCandyLook(value: unknown): CandyLook | null {
  return isCandyLook(value) ? Object.freeze({ ...value }) : null;
}

/** Candy's rules for the look sync (play/look-sync.ts): the same engine as Play's, HUD's and Arcade's. */
export const CANDY_LOOK_RULES: LookRules<CandyLook> = Object.freeze({
  themeId: CANDY_THEME_ID,
  check: checkCandyLook,
  isPreset: isPresetId,
  freshId: freshCandyLookId,
  defaultLook: CANDY_DEFAULT_LOOK,
});
