// HUD's look rules, pure (US-018a; the Looks drawer, US-018c, calls them): which look the active
// one was picked from, whether it has been edited since, one knob changed, Save as new look,
// rename, delete and reset. Behaviour references, not vendored: the web's
// frontend/lib/looks/editor.ts (the base look, edited, a fresh id) and
// lib/theme-host/builtin/play-look-state.ts (renaming or deleting the active look), with the HUD
// drawing's own words and save ('Automatos Command HUD.dc.html': 'ARC · EDITED', 'MINE N', reset to
// the look it was picked from). HUD's looks stay on the phone (D59): no server here.

import { LOOK_TEXT_MAX } from '../../core/web/lib/look-kit/validate';
import { plainTextProblem } from '../../core/web/lib/theme-host/css-value';
import { HUD_LOOK_COPY } from '../strings';
import {
  HUD_DEFAULT_LOOK,
  HUD_KNOBS,
  HUD_PRESET_LOOKS,
  hudKnobSpec,
  type HudKnob,
  type HudLook,
} from './look-schema';

/** The most looks a phone keeps: the server's cap for Play's looks. */
export const MAX_HUD_SAVED_LOOKS = 100;

/** A saved look's id is 'mine-N' (a vendored LOOK_ID_PATTERN id). */
export const HUD_SAVED_ID_PREFIX = 'mine-';

/** The phone's HUD looks: the ones the user saved, and the one HUD paints. */
export type HudLooks = {
  readonly saved: readonly HudLook[];
  readonly active: HudLook;
};

export const INITIAL_HUD_LOOKS: HudLooks = Object.freeze({
  saved: Object.freeze([]),
  active: HUD_DEFAULT_LOOK,
});

/** Why a change was refused: a preset is never renamed or deleted; a full phone saves no more. */
export type HudLooksRefusal = 'preset' | 'not-saved' | 'full' | 'name';

export type HudLooksChange =
  | { readonly ok: true; readonly looks: HudLooks }
  | { readonly ok: false; readonly reason: HudLooksRefusal };

function changed(looks: HudLooks): HudLooksChange {
  return { ok: true, looks: Object.freeze(looks) };
}

function refused(reason: HudLooksRefusal): HudLooksChange {
  return { ok: false, reason };
}

/** The preset, else the saved look, with this id. */
function findLook(saved: readonly HudLook[], id: string): HudLook | undefined {
  return HUD_PRESET_LOOKS.find((look) => look.id === id) ?? saved.find((look) => look.id === id);
}

export function isPresetId(id: string): boolean {
  return HUD_PRESET_LOOKS.some((look) => look.id === id);
}

/** The preset or saved look the active look was picked from, as it was saved. */
export function baseLook(look: HudLook, saved: readonly HudLook[]): HudLook | undefined {
  return findLook(saved, look.id);
}

export function sameValues(a: HudLook, b: HudLook): boolean {
  return HUD_KNOBS.every((knob) => a[knob] === b[knob]);
}

/** True when the active look's values differ from the look it was picked from. */
export function isEdited(look: HudLook, saved: readonly HudLook[]): boolean {
  const base = baseLook(look, saved);
  return base !== undefined && !sameValues(base, look);
}

/** The drawer's status line: 'ARC', 'ARC · EDITED', or a saved look's name. */
export function statusLine(look: HudLook, saved: readonly HudLook[]): string {
  return isEdited(look, saved) ? HUD_LOOK_COPY.edited(look.name) : look.name;
}

/** `value` as the knob takes it: a whole number within its range, one of its choices, or null. */
function knobValue(knob: HudKnob, value: string | number): string | number | null {
  const spec = hudKnobSpec(knob);
  if (spec.kind === 'choice') {
    return typeof value === 'string' && spec.choices.includes(value) ? value : null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)));
}

/**
 * A copy of the look with one knob changed: a number knob whole and clamped to its range, a
 * choice knob only to one of its choices. A value the knob cannot take returns `look` itself.
 */
export function withValue(look: HudLook, knob: HudKnob, value: string | number): HudLook {
  const next = knobValue(knob, value);
  if (next === null || next === look[knob]) return look;
  return Object.freeze({ ...look, [knob]: next });
}

/** The active look with one knob changed (withValue). */
export function setKnob(looks: HudLooks, knob: HudKnob, value: string | number): HudLooks {
  const active = withValue(looks.active, knob, value);
  return active === looks.active ? looks : Object.freeze({ ...looks, active });
}

/** A preset or saved look made the active one, unedited; an unknown id changes nothing. */
export function pickLook(looks: HudLooks, id: string): HudLooks {
  const picked = findLook(looks.saved, id);
  return picked === undefined ? looks : Object.freeze({ ...looks, active: picked });
}

/** The lowest N from 1 that no preset or saved look uses as 'mine-N' or as 'MINE N'. */
function freshNumber(saved: readonly HudLook[]): number {
  const taken = [...HUD_PRESET_LOOKS, ...saved];
  const ids = new Set(taken.map((look) => look.id));
  const names = new Set(taken.map((look) => look.name));
  let n = 1;
  while (ids.has(`${HUD_SAVED_ID_PREFIX}${n}`) || names.has(HUD_LOOK_COPY.savedName(n))) n += 1;
  return n;
}

/**
 * 'Save as new look': the active values as 'mine-N' / 'MINE N' (a vendored LOOK_ID_PATTERN id),
 * saved and made the active look, so it reads unedited. A phone holding MAX_HUD_SAVED_LOOKS saves
 * no more.
 */
export function saveAsNew(looks: HudLooks): HudLooksChange {
  if (looks.saved.length >= MAX_HUD_SAVED_LOOKS) return refused('full');
  const n = freshNumber(looks.saved);
  const id = `${HUD_SAVED_ID_PREFIX}${n}`;
  const look: HudLook = Object.freeze({ ...looks.active, id, name: HUD_LOOK_COPY.savedName(n) });
  return changed({ saved: Object.freeze([...looks.saved, look]), active: look });
}

/** Why a saved look's id cannot be renamed or deleted, or null when it can. */
function savedProblem(looks: HudLooks, id: string): HudLooksRefusal | null {
  if (isPresetId(id)) return 'preset';
  return looks.saved.some((look) => look.id === id) ? null : 'not-saved';
}

/**
 * A saved look renamed: the name trimmed, then 1 to 40 characters of one line of plain text (the
 * vendored rule). A preset keeps its name. Renaming the active look renames what HUD paints too.
 */
export function renameLook(looks: HudLooks, id: string, name: string): HudLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const trimmed = name.trim();
  if (plainTextProblem(trimmed, 'name', LOOK_TEXT_MAX) !== null) return refused('name');
  const rename = (look: HudLook): HudLook =>
    look.id === id ? Object.freeze({ ...look, name: trimmed }) : look;
  return changed({ saved: Object.freeze(looks.saved.map(rename)), active: rename(looks.active) });
}

/** A saved look deleted; a preset never is. Deleting the active look puts HUD back on ARC. */
export function deleteLook(looks: HudLooks, id: string): HudLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const saved = Object.freeze(looks.saved.filter((look) => look.id !== id));
  return changed({ saved, active: looks.active.id === id ? HUD_DEFAULT_LOOK : looks.active });
}

/** RESET: the active look back to the look it was picked from (ARC when that is gone). */
export function resetLook(looks: HudLooks): HudLooks {
  const base = baseLook(looks.active, looks.saved) ?? HUD_DEFAULT_LOOK;
  return base === looks.active ? looks : Object.freeze({ ...looks, active: base });
}
