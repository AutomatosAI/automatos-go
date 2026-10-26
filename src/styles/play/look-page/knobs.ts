// The knobs of Play's look page (US-017e, 'Automatos Play Looks.dc.html'), pure: each section's
// heading and its options in the vendored catalogue's names and order — Accent, Background, Type,
// Auto's shell, Auto's light — which one is selected, the words VoiceOver reads for it ('Molten
// accent, selected') and what choosing it changes; the Glow slider (look-page.ts glowKnob); the
// faces the Type options and the looks row are set in; and the design's numbers for the page.
// Colours are the vendored catalogue's own entries (K14: the catalogue counts as tokens).

import {
  ACCENTS,
  ACCENT_KEYS,
  GROUNDS,
  GROUND_KEYS,
  LIGHTS,
  LIGHT_KEYS,
  SHELLS,
  SHELL_KEYS,
  TYPE_STYLES,
  TYPE_STYLE_KEYS,
  type AccentKey,
  type GroundKey,
  type LightKey,
  type ShellKey,
  type TypeStyleKey,
} from '../../../core/frozen/lib/looks/catalogue';
import type { Look } from '../../../core/frozen/lib/looks/types';
import { PLAY_LOOK_COPY } from '../../strings';
import type { TypeStyle } from '../../type';
import { styleType } from '../../typeface/scale';
import { glowKnob, type GlowKnob, type LookValues } from '../look-page';

/** The design's numbers for the page, in points (the 360 pt editor column, laid out for 390). */
export const LOOK_PAGE = Object.freeze({
  /** Apple's least touch target. */
  target: 44,
  pressedOpacity: 0.7,
  /** Between the page's parts (the design's 22 to 28). */
  pageGap: 28,
  sectionGap: 10,
  /** A selected option's line in the accent; the others' in the ground's line. */
  selectedLine: 2,
  restLine: 1,
  row: Object.freeze({
    width: 136,
    radius: 12,
    gap: 12,
    swatchHeight: 84,
    swatchPadX: 12,
    swatchPadY: 10,
    sampleSize: 34,
    light: 14,
    lightLine: 2,
    lightGlow: 8,
    bar: Object.freeze({ width: 34, height: 12, radius: 4 }),
    marksGap: 6,
    padX: 12,
    padTop: 9,
    padBottom: 11,
    nameSize: 13,
    subSize: 12,
    wordsGap: 2,
  }),
  swatch: Object.freeze({ size: 40, border: 2, ring: 2, gap: 10 }),
  ground: Object.freeze({
    height: 48,
    swatch: 24,
    swatchRadius: 6,
    gap: 8,
    inner: 10,
    padX: 10,
    size: 13,
  }),
  font: Object.freeze({ height: 46, gap: 6, padX: 14, faceSize: 12 }),
  finish: Object.freeze({ height: 44, dot: 12, dotGlow: 8, gap: 6, inner: 7, size: 13 }),
  actions: Object.freeze({ height: 46, gap: 8, resetPadX: 16 }),
  preview: Object.freeze({ radius: 16, padX: 18, padY: 24, gap: 14, chipGap: 8 }),
});

export type KnobOption<K extends string> = {
  readonly key: K;
  readonly name: string;
  /** The option's swatch: the accent, the ground's page, the shell or the light; null for Type. */
  readonly colour: string | null;
  /** Type's face name ('Instrument Serif'), shown beside the name; null elsewhere. */
  readonly detail: string | null;
  readonly selected: boolean;
  /** What VoiceOver reads: 'Molten accent, selected'. */
  readonly label: string;
  /** What choosing it changes in the look. */
  readonly values: Partial<LookValues>;
};

export type KnobSection<K extends string> = {
  readonly title: string;
  readonly options: readonly KnobOption<K>[];
};

export type LookKnobs = {
  readonly accent: KnobSection<AccentKey>;
  readonly ground: KnobSection<GroundKey>;
  readonly font: KnobSection<TypeStyleKey>;
  readonly shell: KnobSection<ShellKey>;
  readonly light: KnobSection<LightKey>;
  readonly glow: GlowKnob & { readonly title: string };
};

type Kind = keyof typeof PLAY_LOOK_COPY.kinds;

type Entry = {
  readonly name: string;
  readonly colour: string | null;
  readonly detail?: string;
  readonly values: Partial<LookValues>;
};

function section<K extends string>(
  kind: Kind,
  title: string,
  keys: readonly K[],
  current: K,
  entry: (key: K) => Entry,
): KnobSection<K> {
  const options = keys.map((key) => {
    const { name, colour, detail = null, values } = entry(key);
    const selected = key === current;
    const label = PLAY_LOOK_COPY.option(name, PLAY_LOOK_COPY.kinds[kind], selected);
    return Object.freeze({ key, name, colour, detail, selected, label, values });
  });
  return Object.freeze({ title, options: Object.freeze(options) });
}

/** Every knob of the look, as the page draws it. */
export function lookKnobs(look: Look): LookKnobs {
  const said = PLAY_LOOK_COPY.knobs;
  const accentTitle = PLAY_LOOK_COPY.accentTitle(ACCENTS[look.accent].name);
  return Object.freeze({
    accent: section('accent', accentTitle, ACCENT_KEYS, look.accent, (key) => ({
      name: ACCENTS[key].name,
      colour: ACCENTS[key].hex,
      values: { accent: key },
    })),
    ground: section('ground', said.ground, GROUND_KEYS, look.ground, (key) => ({
      name: GROUNDS[key].name,
      colour: GROUNDS[key].bg,
      values: { ground: key },
    })),
    font: section('font', said.font, TYPE_STYLE_KEYS, look.font, (key) => ({
      name: TYPE_STYLES[key].name,
      colour: null,
      detail: TYPE_STYLES[key].face,
      values: { font: key },
    })),
    shell: section('shell', said.shell, SHELL_KEYS, look.shell, (key) => ({
      name: SHELLS[key].name,
      colour: SHELLS[key].hex,
      values: { shell: key },
    })),
    light: section('light', said.light, LIGHT_KEYS, look.light, (key) => ({
      name: LIGHTS[key].name,
      colour: LIGHTS[key].hex,
      values: { light: key },
    })),
    glow: Object.freeze({ ...glowKnob(look), title: said.glow }),
  });
}

/** A Type option's name, set in its own display face (Play's small card slot: 19 in the serif). */
export function optionFace(font: TypeStyleKey): TypeStyle {
  return styleType({ layout: 'play', font }).display('cardSm');
}

/** The looks row's 'Aa': the look's display face at the design's 34, its tracking scaled too. */
export function sampleFace(font: TypeStyleKey): TypeStyle {
  const card = styleType({ layout: 'play', font }).display('card');
  const size = LOOK_PAGE.row.sampleSize;
  const letterSpacing = (card.letterSpacing * size) / card.fontSize;
  return Object.freeze({ ...card, fontSize: size, lineHeight: size, letterSpacing });
}

/** The looks row's swatch for a look: its ground's page and text, its accent and its light. */
export type RowSwatch = {
  readonly ground: string;
  readonly text: string;
  readonly accent: string;
  readonly light: string;
};

export function rowSwatch(look: Look): RowSwatch {
  const ground = GROUNDS[look.ground];
  return Object.freeze({
    ground: ground.bg,
    text: ground.text,
    accent: ACCENTS[look.accent].hex,
    light: LIGHTS[look.light].hex,
  });
}

export type OptionFrame = { readonly borderWidth: number; readonly borderColor: string };

/** An option's frame: a 2 pt line in the accent when selected, else 1 pt in the ground's line. */
export function optionFrame(
  selected: boolean,
  vars: { readonly accent: string; readonly groundLine: string },
): OptionFrame {
  return selected
    ? Object.freeze({ borderWidth: LOOK_PAGE.selectedLine, borderColor: vars.accent })
    : Object.freeze({ borderWidth: LOOK_PAGE.restLine, borderColor: vars.groundLine });
}
