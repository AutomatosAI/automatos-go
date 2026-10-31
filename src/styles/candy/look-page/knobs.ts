// Make it sweet's knob rows (US-023m, D-CAN-3; the kit's looks/look-controls.tsx at 3920359d5),
// pure: each of looks/schema.json's six knobs as the row the page draws, under the schema's label,
// in its order. Palette is three round swatches, each its palette's first two card colours (the
// catalogue's starts, swatchOf), named by the palette for VoiceOver; Card colours and Gradient are
// segmented rows of spec.ts KNOBS' words (Gradient with its note, CANDY_GRADIENT_NOTES); Roundness
// is a slider of whole points 16–40 whose position is written as its choice key (sliderKey through
// setKnob); Glow a slider 0–10 (setNumber); Motion a switch, which under Reduce Motion is off, says
// 'Motion off · Reduce Motion' and cannot be changed, since nothing moves then anyway. The chosen
// choice is checked for VoiceOver and carries a ✓ on screen, never colour alone. Pure: no React.

import { nearestRadius } from '../../tokens/candy';
import { CARD_SETS, paletteById } from '../../tokens/candy-catalogue';
import {
  CANDY_CHOICE_WORDS,
  CANDY_GRADIENT_NOTES,
  CANDY_LOOK_SCHEMA,
  candyChoiceSpec,
  candyNumberSpec,
  type CandyLook,
  type CandyMotion,
} from '../look-schema';
import { CANDY_SWEET_COPY } from '../strings';

const said = CANDY_SWEET_COPY;

/** The knobs drawn as a segmented row. */
export type SegmentKnob = 'cards' | 'gradient';

/** One choice in a row: its key, its word, whether the look has it, what VoiceOver hears. */
export type SweetChoice = {
  readonly value: string;
  readonly word: string;
  readonly selected: boolean;
  readonly label: string;
};

function title(knob: keyof typeof CANDY_LOOK_SCHEMA.knobs): string {
  return CANDY_LOOK_SCHEMA.knobs[knob].label ?? knob;
}

function choiceOf(
  knob: keyof typeof CANDY_CHOICE_WORDS,
  value: string,
  current: string,
): SweetChoice {
  const word = CANDY_CHOICE_WORDS[knob][value] ?? value;
  return Object.freeze({ value, word, selected: value === current, label: word });
}

/** A palette's swatch: its first two card colours' starts, in the palette's order. */
export type Swatch = { readonly a: string; readonly b: string };

export function swatchOf(id: string): Swatch | null {
  const palette = paletteById(id);
  if (palette === undefined) return null;
  const [first, second] = palette.order;
  return Object.freeze({ a: CARD_SETS[first].a, b: CARD_SETS[second].a });
}

export type PaletteRow = {
  readonly title: string;
  readonly choices: readonly (SweetChoice & { readonly swatch: Swatch | null })[];
};

/** Palette: the three palettes in the schema's order, each named by the catalogue. */
export function paletteRow(look: CandyLook): PaletteRow {
  const choices = candyChoiceSpec('palette').choices.map((value) =>
    Object.freeze({ ...choiceOf('palette', value, look.palette), swatch: swatchOf(value) }),
  );
  return Object.freeze({ title: title('palette'), choices: Object.freeze(choices) });
}

export type SegmentRow = {
  readonly knob: SegmentKnob;
  readonly title: string;
  readonly choices: readonly SweetChoice[];
  /** Under the Gradient row, what the look's choice does; null under Card colours. */
  readonly note: string | null;
};

/** Card colours (Mixed / One colour) or Gradient (Soft / Rich / Vivid, with its note). */
export function segmentRow(look: CandyLook, knob: SegmentKnob): SegmentRow {
  const choices = candyChoiceSpec(knob).choices.map((value) => choiceOf(knob, value, look[knob]));
  const note = knob === 'gradient' ? CANDY_GRADIENT_NOTES[look.gradient] : null;
  return Object.freeze({ knob, title: title(knob), choices: Object.freeze(choices), note });
}

export type SliderRow = {
  readonly title: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Beside the slider: '28 pt', '6'. */
  readonly shown: string;
  /** What VoiceOver hears for a position: '28 points', '6 of 10'. */
  readonly spoken: (value: number) => string;
};

/** Roundness: the look's key as the whole number it names, 16–40 (spec.ts ROUNDNESS_VALUES). */
export function roundnessRow(look: CandyLook): SliderRow {
  const keys = candyChoiceSpec('roundness').choices;
  const value = nearestRadius(look.roundness);
  return Object.freeze({
    title: title('roundness'),
    value,
    min: Number(keys[0]),
    max: Number(keys[keys.length - 1]),
    shown: said.roundness.shown(value),
    spoken: said.roundness.spoken,
  });
}

/** Glow: a whole number 0–10 (the schema's number knob). */
export function glowRow(look: CandyLook): SliderRow {
  const { min, max } = candyNumberSpec('glow');
  return Object.freeze({
    title: title('glow'),
    value: look.glow,
    min,
    max,
    shown: said.glow.shown(look.glow),
    spoken: (value: number) => said.glow.spoken(value, max),
  });
}

export type MotionRow = {
  readonly title: string;
  /** The switch: on while the look moves and Reduce Motion is off. */
  readonly on: boolean;
  /** Under Reduce Motion: off and cannot be changed. */
  readonly disabled: boolean;
  /** Beside the switch: what it means now. */
  readonly words: string;
};

/** Motion (look-controls.tsx MotionSwitch): the look's own, synced; never the phone's pause. */
export function motionRow(look: CandyLook, reduceMotion: boolean): MotionRow {
  const on = !reduceMotion && look.motion === 'on';
  const words = reduceMotion ? said.motion.reduced : on ? said.motion.on : said.motion.paused;
  return Object.freeze({ title: title('motion'), on, disabled: reduceMotion, words });
}

/** The look's Motion a flip of the switch writes. */
export function motionValue(on: boolean): CandyMotion {
  return on ? 'on' : 'paused';
}
