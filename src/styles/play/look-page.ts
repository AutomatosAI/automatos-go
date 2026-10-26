// Play's look page 'Make it yours' (US-017e, D55), pure: which look the active one was picked
// from, whether it has been edited since, the looks row, the glow and its cap, and every change the
// page makes to the phone's Play looks — a knob, a pick, Save as new look, Rename, Duplicate,
// Delete and Reset. Behaviour references, not vendored: the web's frontend/lib/looks/editor.ts
// (the base look, edited, 'My look N', '<name> copy', the glow's clamp and words) and
// lib/theme-host/builtin/play-look-state.ts and play-look-store.ts (a preset is never saved over,
// renamed or deleted; renaming or deleting the active look follows it; deleting it puts Play back
// on Ember) at the pin 630fc1c85. The colours and the cap are the vendored engine's (safeGlow);
// the page hands each new PlayLooks to the style store, and the look sync sends it (US-017d).

import { safeGlow, validateLook } from '../../core/frozen/lib/looks/engine';
import { DEFAULT_LOOK, PRESETS, findPreset, isPresetId } from '../../core/frozen/lib/looks/presets';
import { GLOW_MAX, GLOW_MIN, type Look } from '../../core/frozen/lib/looks/types';
import { LOOK_TEXT_MAX } from '../../core/web/lib/look-kit/validate';
import { FLIP_CROSSFADE_MS } from '../provider/flip-plan';
import { PLAY_LOOK_COPY } from '../strings';
import type { LookSyncStatus } from './look-sync';
import { MAX_SAVED_LOOKS } from './looks-schemas';
import { freshPlayLookId, type PlayLooks } from './play-looks';

/** The fields the knobs change; everything else (schema, id, name, sub) stays as picked. */
export const EDITABLE_FIELDS = [
  'ground',
  'accent',
  'font',
  'shell',
  'light',
  'glow',
] as const satisfies readonly (keyof Look)[];

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type LookValues = Pick<Look, EditableField>;

/** The preset, else the saved look, with this id. */
function findLook(saved: readonly Look[], id: string): Look | undefined {
  return findPreset(id) ?? saved.find((look) => look.id === id);
}

/** The preset or saved look the active look was picked from, as it was saved. */
export function baseLook(look: Look, saved: readonly Look[]): Look | undefined {
  return findLook(saved, look.id);
}

export function sameValues(a: Look, b: Look): boolean {
  return EDITABLE_FIELDS.every((field) => a[field] === b[field]);
}

/** True when the active look's values differ from the look it was picked from. */
export function isEdited(look: Look, saved: readonly Look[]): boolean {
  const base = baseLook(look, saved);
  return base !== undefined && !sameValues(base, look);
}

/** The line beside the heading: 'Ember', or 'Ember · edited'. */
export function statusLine(looks: PlayLooks): string {
  const { active, saved } = looks;
  return isEdited(active, saved) ? PLAY_LOOK_COPY.edited(active.name) : active.name;
}

// ── The glow ───────────────────────────────────────────────────────────────────────────────────

/** A reading as a whole glow from GLOW_MIN to `max` (the look's safeGlow), never past GLOW_MAX. */
export function clampGlow(value: number, max: number = GLOW_MAX): number {
  if (!Number.isFinite(value)) return GLOW_MIN;
  return Math.min(max, GLOW_MAX, Math.max(GLOW_MIN, Math.round(value)));
}

/** 'Off' at 0, else '24%'. */
export function glowLabel(glow: number): string {
  return glow === GLOW_MIN ? PLAY_LOOK_COPY.glowOff : PLAY_LOOK_COPY.glowShown(glow);
}

export type GlowKnob = {
  readonly min: number;
  readonly max: number;
  /** Where the slider stops: the strongest glow the look's ground and accent keep readable. */
  readonly cap: number;
  /** The glow Play paints: the look's, never past the cap. */
  readonly value: number;
  readonly label: string;
};

/** The Glow slider for a look: GLOW_MIN to GLOW_MAX, stopping at the vendored safeGlow. */
export function glowKnob(look: Look): GlowKnob {
  const cap = safeGlow(look.ground, look.accent);
  const value = clampGlow(look.glow, cap);
  return Object.freeze({ min: GLOW_MIN, max: GLOW_MAX, cap, value, label: glowLabel(value) });
}

/** The glow in words for VoiceOver: 'Off', '24 percent', or why it stops at the cap. */
export function glowWords(glow: number, cap: number): string {
  if (glow === GLOW_MIN) return PLAY_LOOK_COPY.glowOff;
  return glow >= cap ? PLAY_LOOK_COPY.glowAtCap(glow) : PLAY_LOOK_COPY.glowWords(glow);
}

// ── Knobs and picks ────────────────────────────────────────────────────────────────────────────

/** The active look with some values changed (the glow whole and within its cap). */
export function setValues(looks: PlayLooks, values: Partial<LookValues>): PlayLooks {
  const next: Look = { ...looks.active, ...values };
  const glow = values.glow === undefined ? next.glow : clampGlow(values.glow, glowKnob(next).cap);
  const active = Object.freeze({ ...next, glow });
  return sameValues(active, looks.active) ? looks : Object.freeze({ ...looks, active });
}

/** A pick from the looks row crossfades the whole app as a flip does; at once under Reduce Motion. */
export function pickCrossfadeMs(reduceMotion: boolean): number {
  return reduceMotion ? 0 : FLIP_CROSSFADE_MS;
}

/** A preset or saved look made the active one, unedited; an unknown id changes nothing. */
export function pickLook(looks: PlayLooks, id: string): PlayLooks {
  const picked = findLook(looks.saved, id);
  return picked === undefined ? looks : Object.freeze({ ...looks, active: picked });
}

export type LookRowItem = {
  readonly look: Look;
  readonly selected: boolean;
  /** One of the user's saved looks: a long press opens Rename, Duplicate and Delete. */
  readonly own: boolean;
  /** What VoiceOver reads: 'Ember, Warm, editorial, selected'. */
  readonly label: string;
};

function rowItem(look: Look, activeId: string, own: boolean): LookRowItem {
  const selected = look.id === activeId;
  const label = PLAY_LOOK_COPY.look(look.name, look.sub, selected);
  return Object.freeze({ look, selected, own, label });
}

/** The looks row: the five presets with their subs, then the saved looks. */
export function looksRow(looks: PlayLooks): readonly LookRowItem[] {
  const { active, saved } = looks;
  return Object.freeze([
    ...PRESETS.map((look) => rowItem(look, active.id, false)),
    ...saved.map((look) => rowItem(look, active.id, true)),
  ]);
}

// ── Save, rename, duplicate, delete, reset ─────────────────────────────────────────────────────

/** Why a change was refused: a preset is never changed; a full phone saves no more. */
export type PlayLooksRefusal = 'preset' | 'not-saved' | 'full' | 'name';

export type PlayLooksChange =
  | { readonly ok: true; readonly looks: PlayLooks }
  | { readonly ok: false; readonly reason: PlayLooksRefusal };

function changed(looks: PlayLooks): PlayLooksChange {
  return { ok: true, looks: Object.freeze(looks) };
}

function refused(reason: PlayLooksRefusal): PlayLooksChange {
  return { ok: false, reason };
}

/** What the page says about a refusal. */
export function refusalCopy(reason: PlayLooksRefusal): string {
  return PLAY_LOOK_COPY.refusals[reason];
}

/** 'My look N' with the lowest N from the number of saved looks up that no saved look is called. */
export function newLookName(saved: readonly Look[]): string {
  const names = new Set(saved.map((look) => look.name));
  let n = saved.length + 1;
  while (names.has(PLAY_LOOK_COPY.savedName(n))) n += 1;
  return PLAY_LOOK_COPY.savedName(n);
}

/** Adds a look to the saved ones and makes it the active look (it then reads unedited). */
function withSaved(looks: PlayLooks, look: Look): PlayLooksChange {
  if (looks.saved.length >= MAX_SAVED_LOOKS) return refused('full');
  const kept = Object.freeze(look);
  return changed({ saved: Object.freeze([...looks.saved, kept]), active: kept });
}

/** 'Save as new look': the active values as 'look-N', 'My look N', 'Your look'. */
export function saveAsNew(looks: PlayLooks): PlayLooksChange {
  const { active, saved } = looks;
  const id = freshPlayLookId(saved);
  const name = newLookName(saved);
  return withSaved(looks, { ...active, id, name, sub: PLAY_LOOK_COPY.savedSub });
}

type OwnLook = { readonly look: Look } | { readonly reason: PlayLooksRefusal };

/** The saved look a rename, duplicate or delete acts on, or why there is none (a preset). */
function ownLook(looks: PlayLooks, id: string): OwnLook {
  if (isPresetId(id)) return { reason: 'preset' };
  const look = looks.saved.find((entry) => entry.id === id);
  return look === undefined ? { reason: 'not-saved' } : { look };
}

/**
 * A saved look renamed: trimmed, then 1 to 40 characters of one line of plain text (the vendored
 * validateLook). A preset keeps its name. Renaming the active look renames what Play paints too.
 */
export function renameLook(looks: PlayLooks, id: string, name: string): PlayLooksChange {
  const own = ownLook(looks, id);
  if ('reason' in own) return refused(own.reason);
  const checked = validateLook({ ...own.look, name });
  if (!checked.ok) return refused('name');
  const kept = checked.look.name;
  const rename = (look: Look): Look =>
    look.id === id ? Object.freeze({ ...look, name: kept }) : look;
  return changed({ saved: Object.freeze(looks.saved.map(rename)), active: rename(looks.active) });
}

/** Room for ' copy 99' after the clipped name, so the copy's name stays within LOOK_TEXT_MAX. */
const COPY_ROOM = 8;

/** 'Ember copy', then 'Ember copy 2'... the first no preset or saved look is called. */
export function copyName(name: string, saved: readonly Look[]): string {
  const taken = new Set([...PRESETS, ...saved].map((look) => look.name));
  const base = Array.from(name).slice(0, LOOK_TEXT_MAX - COPY_ROOM).join('').trim();
  const word = PLAY_LOOK_COPY.copyWord;
  let candidate = `${base} ${word}`;
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${base} ${word} ${n}`;
  return candidate;
}

/**
 * Duplicate: a copy of the saved look under a fresh id and '<name> copy', made the active look.
 * The active look is copied as it is now, edits included (the web's Duplicate).
 */
export function duplicateLook(looks: PlayLooks, id: string): PlayLooksChange {
  const own = ownLook(looks, id);
  if ('reason' in own) return refused(own.reason);
  const { active, saved } = looks;
  const from = active.id === id ? active : own.look;
  const copy = { ...from, id: freshPlayLookId(saved), name: copyName(from.name, saved) };
  return withSaved(looks, copy);
}

/** A saved look deleted; a preset never is. Deleting the active look puts Play back on Ember. */
export function deleteLook(looks: PlayLooks, id: string): PlayLooksChange {
  const own = ownLook(looks, id);
  if ('reason' in own) return refused(own.reason);
  const saved = Object.freeze(looks.saved.filter((look) => look.id !== id));
  return changed({ saved, active: looks.active.id === id ? DEFAULT_LOOK : looks.active });
}

/** Reset needs a look to go back to: the preset or saved look the active one was picked from. */
export function canReset(looks: PlayLooks): boolean {
  return baseLook(looks.active, looks.saved) !== undefined;
}

/** Reset: the active look back to the look it was picked from; nothing to go back to, no change. */
export function resetLook(looks: PlayLooks): PlayLooks {
  const base = baseLook(looks.active, looks.saved);
  if (base === undefined || base === looks.active) return looks;
  return Object.freeze({ ...looks, active: base });
}

// ── The sync's words ───────────────────────────────────────────────────────────────────────────

export type SyncLine = {
  /** 'Kept on this phone only' while Play is not installed in the workspace; else null. */
  readonly title: string | null;
  /** Why: how to change that, or the failure's own words. */
  readonly reason: string;
};

/** What the page says about the look sync (US-017d's notice), or null when it is in step. */
export function syncLine(
  status: Pick<LookSyncStatus, 'synced'>,
  notice: string | null,
  localOnly: string,
): SyncLine | null {
  if (notice === null) return null;
  const title = status.synced === 'local-only' ? localOnly : null;
  return Object.freeze({ title, reason: notice });
}
