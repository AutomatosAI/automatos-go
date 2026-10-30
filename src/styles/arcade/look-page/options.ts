// Arcade's Options page (US-022j, D-ARC-3), pure: what it draws for the phone's Arcade looks — the
// five knobs as rows of choices (looks/schema.json's labels and order, spec.ts KNOBS' choice words,
// the one chosen marked with the ▶ cursor as well as the highlight, never colour alone), the save
// slots (the five presets, then the person's looks), the line under the heading, and what SAVE
// LOOK and RESET say after (look-transfer.tsx's 'Saved …', look-editor.tsx's 'Back to …'). The
// changes themselves are US-022c's (arcade-looks.ts); the page hands each to the style store,
// which repaints Arcade at once, keeps it on the phone and lets the look sync send it.

import type { LookSheetCopy } from '../../play/look-page/LookSheet';
import { refusalCopy } from '../../play/look-page';
import type { LookSyncStatus } from '../../play/look-sync';
import { ARCADE_OPTIONS_COPY, PLAY_LOOK_COPY } from '../../strings';
import { paletteById } from '../../tokens/arcade-catalogue';
import { resetLook, type ArcadeLooks, type ArcadeLooksChange } from '../arcade-looks';
import {
  ARCADE_DEFAULT_LOOK,
  ARCADE_KNOBS,
  ARCADE_PRESET_LOOKS,
  arcadeKnobSpec,
  type ArcadeKnob,
  type ArcadeLook,
} from '../look-schema';

const said = ARCADE_OPTIONS_COPY;

/** The phone's Options (the 'Phone 390' options: 12 px padding, 6 px gaps, 44 px choices), in pt. */
export const OPTIONS_PAGE = Object.freeze({
  pageGap: 20,
  headGap: 8,
  windowPad: 12,
  windowGap: 12,
  row: Object.freeze({ gap: 6, padV: 10, rule: 2, cursor: 16 }),
  choice: Object.freeze({ gap: 6, padH: 9, ring: 2, size: 15, press: 2 }),
  actionsGap: 16,
  slot: Object.freeze({ gap: 8, padV: 8, padH: 12, ring: 2, press: 2, nameSize: 17, subSize: 15 }),
  noticeSize: 15,
});

/** One choice in a knob's row: its word, whether it is the look's, what VoiceOver hears. */
export type OptionChoice = {
  readonly value: string;
  readonly word: string;
  readonly selected: boolean;
  readonly label: string;
};

/** One knob as a row: the schema's label and the choices in the schema's order. */
export type OptionRow = {
  readonly knob: ArcadeKnob;
  readonly title: string;
  readonly choices: readonly OptionChoice[];
};

/** A choice's word: a palette's name from the catalogue, the others spec.ts KNOBS' words. */
export function choiceWord(knob: ArcadeKnob, value: string): string {
  if (knob === 'palette') return paletteById(value)?.name ?? value;
  return said.choices[knob][value] ?? value;
}

function optionChoice(look: ArcadeLook, knob: ArcadeKnob, value: string): OptionChoice {
  const word = choiceWord(knob, value);
  const label = said.spoken[word] ?? word;
  return Object.freeze({ value, word, selected: look[knob] === value, label });
}

/** The five knobs, in looks/schema.json's order, each with the look's choice selected. */
export function optionRows(look: ArcadeLook): readonly OptionRow[] {
  return Object.freeze(
    ARCADE_KNOBS.map((knob) => {
      const spec = arcadeKnobSpec(knob);
      const choices = spec.choices.map((value) => optionChoice(look, knob, value));
      return Object.freeze({ knob, title: spec.label ?? knob, choices: Object.freeze(choices) });
    }),
  );
}

/** A look in the save slots; a person's own look opens Rename and Delete on a long press. */
export type SaveSlot = {
  readonly look: ArcadeLook;
  readonly selected: boolean;
  readonly own: boolean;
  /** What VoiceOver reads: 'Dungeon, Stone and purple, torch-orange accent, selected'. */
  readonly label: string;
};

function saveSlot(look: ArcadeLook, activeId: string, own: boolean): SaveSlot {
  const selected = look.id === activeId;
  return Object.freeze({ look, selected, own, label: said.slot(look.name, look.sub, selected) });
}

/** The save slots (look-editor.tsx): the five presets, then the person's saved looks. */
export function saveSlots(looks: ArcadeLooks): readonly SaveSlot[] {
  const { active, saved } = looks;
  return Object.freeze([
    ...ARCADE_PRESET_LOOKS.map((look) => saveSlot(look, active.id, false)),
    ...saved.map((look) => saveSlot(look, active.id, true)),
  ]);
}

/** 'Saved per person, per workspace.', or nothing while the looks stay on this phone (a 404). */
export function optionsLead(status: Pick<LookSyncStatus, 'synced'>): string | null {
  return status.synced === 'local-only' ? null : said.lead;
}

/** What the last action did, in words: a status for a success, an alert for a refusal. */
export type OptionsSaid = { readonly kind: 'done' | 'failed'; readonly text: string };

export function done(text: string): OptionsSaid {
  return Object.freeze({ kind: 'done', text });
}

export function failed(text: string): OptionsSaid {
  return Object.freeze({ kind: 'failed', text });
}

/** SAVE LOOK's words: 'Saved Save slot 2.', or why the phone saved no more. */
export function savedSaid(change: ArcadeLooksChange): OptionsSaid {
  return change.ok
    ? done(said.saved(change.looks.active.name))
    : failed(refusalCopy(change.reason));
}

/** RESET's words: 'Back to Dungeon.', the palette's preset it goes back to. */
export function resetSaid(looks: ArcadeLooks): OptionsSaid {
  return done(said.backTo(resetLook(looks).active.name));
}

/** A change the phone could not keep (the store refused it): it lasts until the app closes. */
export const NOT_KEPT: OptionsSaid = failed(PLAY_LOOK_COPY.notKept);

/** The sheet a long press on a saved look opens, in Arcade's words: Rename and Delete. */
export const ARCADE_SHEET_COPY: LookSheetCopy = Object.freeze({
  sheet: PLAY_LOOK_COPY.sheet,
  renamed: PLAY_LOOK_COPY.renamed,
  duplicated: PLAY_LOOK_COPY.duplicated,
  deleted: said.deleted,
  refusal: refusalCopy,
  backTo: ARCADE_DEFAULT_LOOK.name,
});
