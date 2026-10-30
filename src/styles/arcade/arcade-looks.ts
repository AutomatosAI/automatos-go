// Arcade's look rules, pure (US-022c; the Options page, US-022j, calls them): one knob changed,
// a preset or saved look picked, Save look, rename, delete and Reset. HUD's rules are the model
// (hud/hud-looks.ts); the behaviour is the design kit's at 034fa629c (themes/arcade/src/looks/
// spec.ts and look-editor.tsx), ported, not vendored: a saved look is 'mine-N' / 'Save slot N'
// with the line 'From <the look it came from>', N counting on from the saved looks; Reset is the
// palette's preset as it ships; deleting the active look goes back to Overworld. No server here:
// ARCADE_LOOK_RULES hands the look sync (play/look-sync.ts) Arcade's check and fresh-id rule, and
// it keeps the looks in step with the web under 'automatos/arcade' where Arcade is installed in
// the workspace (else they stay on the phone, with words, D-ARC-3).

import { LOOK_TEXT_MAX } from '../../core/web/lib/look-kit/validate';
import { plainTextProblem } from '../../core/web/lib/theme-host/css-value';
import type { LookRules } from '../play/look-sync';
import { ARCADE_LOOK_COPY } from '../strings';
import {
  ARCADE_DEFAULT_LOOK,
  ARCADE_PRESET_LOOKS,
  arcadeKnobSpec,
  isArcadeLook,
  type ArcadeKnob,
  type ArcadeLook,
} from './look-schema';

/** The id Arcade's looks are kept under on the server (the web theme automatos/arcade). */
export const ARCADE_THEME_ID = 'automatos/arcade';

/** The most looks a phone keeps: the server's cap per member and theme. */
export const MAX_ARCADE_SAVED_LOOKS = 100;

/** A saved look's id is 'mine-N' (a vendored LOOK_ID_PATTERN id; spec.ts SAVED_ID_PREFIX). */
export const ARCADE_SAVED_ID_PREFIX = 'mine-';

/** The phone's Arcade looks: the ones the user saved, and the one Arcade paints. */
export type ArcadeLooks = {
  readonly saved: readonly ArcadeLook[];
  readonly active: ArcadeLook;
};

export const INITIAL_ARCADE_LOOKS: ArcadeLooks = Object.freeze({
  saved: Object.freeze([]),
  active: ARCADE_DEFAULT_LOOK,
});

/** Why a change was refused: a preset is never renamed or deleted; a full phone saves no more. */
export type ArcadeLooksRefusal = 'preset' | 'not-saved' | 'full' | 'name';

export type ArcadeLooksChange =
  | { readonly ok: true; readonly looks: ArcadeLooks }
  | { readonly ok: false; readonly reason: ArcadeLooksRefusal };

function changed(looks: ArcadeLooks): ArcadeLooksChange {
  return { ok: true, looks: Object.freeze(looks) };
}

function refused(reason: ArcadeLooksRefusal): ArcadeLooksChange {
  return { ok: false, reason };
}

/** The preset, else the saved look, with this id. */
function findLook(saved: readonly ArcadeLook[], id: string): ArcadeLook | undefined {
  return ARCADE_PRESET_LOOKS.find((look) => look.id === id) ?? saved.find((look) => look.id === id);
}

export function isPresetId(id: string): boolean {
  return ARCADE_PRESET_LOOKS.some((look) => look.id === id);
}

/**
 * A copy of the look with one knob changed (spec.ts withChoice: still the same look, edited), only
 * to one of the knob's choices; a value the knob cannot take returns `look` itself.
 */
export function withValue(look: ArcadeLook, knob: ArcadeKnob, value: string): ArcadeLook {
  if (!arcadeKnobSpec(knob).choices.includes(value) || look[knob] === value) return look;
  return Object.freeze({ ...look, [knob]: value });
}

/** The active look with one knob changed (withValue). */
export function setKnob(looks: ArcadeLooks, knob: ArcadeKnob, value: string): ArcadeLooks {
  const active = withValue(looks.active, knob, value);
  return active === looks.active ? looks : Object.freeze({ ...looks, active });
}

/** A preset or saved look made the active one, as it was saved; an unknown id changes nothing. */
export function pickLook(looks: ArcadeLooks, id: string): ArcadeLooks {
  const picked = findLook(looks.saved, id);
  return picked === undefined ? looks : Object.freeze({ ...looks, active: picked });
}

/** spec.ts freshNumber: from one past the count of `taken`, the first N no look has as 'mine-N'. */
function freshNumber(taken: readonly ArcadeLook[]): number {
  const ids = new Set([...ARCADE_PRESET_LOOKS, ...taken].map((look) => look.id));
  let n = taken.length + 1;
  while (ids.has(`${ARCADE_SAVED_ID_PREFIX}${n}`)) n += 1;
  return n;
}

/** 'mine-N' as Save look numbers it, an id no preset and no look in `taken` uses. */
export function freshArcadeLookId(taken: readonly ArcadeLook[]): string {
  return `${ARCADE_SAVED_ID_PREFIX}${freshNumber(taken)}`;
}

/** 'From <name>' (spec.ts asNewLook), or no line when that is longer than a look's text may be. */
function savedSub(name: string): string {
  const sub = ARCADE_LOOK_COPY.savedSub(name);
  return plainTextProblem(sub, 'sub', LOOK_TEXT_MAX) === null ? sub : '';
}

/**
 * 'Save look' (spec.ts asNewLook): the active values as 'mine-N' / 'Save slot N' with the line
 * 'From <the active look's name>', saved and made the active look. A phone holding
 * MAX_ARCADE_SAVED_LOOKS saves no more.
 */
export function saveAsNew(looks: ArcadeLooks): ArcadeLooksChange {
  if (looks.saved.length >= MAX_ARCADE_SAVED_LOOKS) return refused('full');
  const n = freshNumber(looks.saved);
  const { active } = looks;
  const look: ArcadeLook = Object.freeze({
    ...active,
    id: `${ARCADE_SAVED_ID_PREFIX}${n}`,
    name: ARCADE_LOOK_COPY.savedName(n),
    sub: savedSub(active.name),
  });
  return changed({ saved: Object.freeze([...looks.saved, look]), active: look });
}

/** Why a saved look's id cannot be renamed or deleted, or null when it can. */
function savedProblem(looks: ArcadeLooks, id: string): ArcadeLooksRefusal | null {
  if (isPresetId(id)) return 'preset';
  return looks.saved.some((look) => look.id === id) ? null : 'not-saved';
}

/**
 * A saved look renamed: the name trimmed, then 1 to 40 characters of one line of plain text (the
 * vendored rule). A preset keeps its name. Renaming the active look renames what Arcade paints too.
 */
export function renameLook(looks: ArcadeLooks, id: string, name: string): ArcadeLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const trimmed = name.trim();
  if (plainTextProblem(trimmed, 'name', LOOK_TEXT_MAX) !== null) return refused('name');
  const rename = (look: ArcadeLook): ArcadeLook =>
    look.id === id ? Object.freeze({ ...look, name: trimmed }) : look;
  return changed({ saved: Object.freeze(looks.saved.map(rename)), active: rename(looks.active) });
}

/** A saved look deleted; a preset never is. Deleting the active look puts Arcade on Overworld. */
export function deleteLook(looks: ArcadeLooks, id: string): ArcadeLooksChange {
  const problem = savedProblem(looks, id);
  if (problem !== null) return refused(problem);
  const saved = Object.freeze(looks.saved.filter((look) => look.id !== id));
  return changed({ saved, active: looks.active.id === id ? ARCADE_DEFAULT_LOOK : looks.active });
}

/** RESET (spec.ts resetOf): the active palette's preset as it ships; its saved looks stay. */
export function resetLook(looks: ArcadeLooks): ArcadeLooks {
  const { palette } = looks.active;
  const ofPalette = ARCADE_PRESET_LOOKS.find((look) => look.palette === palette);
  const preset = ofPalette ?? ARCADE_DEFAULT_LOOK;
  return preset === looks.active ? looks : Object.freeze({ ...looks, active: preset });
}

/** A look as Arcade takes it (the vendored validateLook over ARCADE_LOOK_SPEC), or null. */
function checkArcadeLook(value: unknown): ArcadeLook | null {
  return isArcadeLook(value) ? Object.freeze({ ...value }) : null;
}

/** Arcade's rules for the look sync (play/look-sync.ts): the same engine as Play's and HUD's. */
export const ARCADE_LOOK_RULES: LookRules<ArcadeLook> = Object.freeze({
  themeId: ARCADE_THEME_ID,
  check: checkArcadeLook,
  isPreset: isPresetId,
  freshId: freshArcadeLookId,
  defaultLook: ARCADE_DEFAULT_LOOK,
});
