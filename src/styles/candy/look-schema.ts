// Candy's looks in the web's own shape (PRD-001 §4.6.2, D-CAN-3, KA3-VENDOR-PIN): the design
// kit's looks/schema.json ('automatos-look-schema/v1'; look schema 'candy-look/v1', interface
// 'candy'; six knobs: palette, cards, gradient and motion choices, roundness a choice of the keys
// '16' to '40' since kit 1.0.1, glow a whole number 0–10, with the kit's labels and defaults), its
// three presets, one per palette, and the words spec.ts gives each choice and the Gradient row's
// notes, copied as data. The schema is checked at load by the vendored validateLookSchema (which
// takes number knobs) and every look by the vendored validateLook (lib/theme-host/look-schema.ts,
// the server's own rules), never a second validator. Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit at 3920359d5 (3920359d5350960471aca1b7111f6243be537cc0),
// each file under themes/candy/ with its sha256:
//   looks/schema.json
//     49f225934b8af8582a963d2f16d4257553988546063c4e78271e586510e1018f
//   looks/presets/blush.look.json
//     3a7c7d3e717e9624ed725bb7eae6a51e121227442e8d89bd22ec2d776d0a8715
//   looks/presets/lilac.look.json
//     70ac5355d89f9a3cf70f05a38560abafdaa9218739883c1c6a0ba9b1ed7ee007
//   looks/presets/nightbloom.look.json
//     5603e3d39ddb1cd1a9a1a7b2dffaff1bf3af96f3c1956cfdf95c2c6be6927506
//   src/looks/spec.ts (KNOBS' choice words, GRADIENT_NOTES, the Roundness keys' range)
//     ddb19acbb4161856493eb3229602b1f35baa84644008ae0c55dc13eebb9a6643
// Values are copied, never retuned: a change starts there. The presets are in the catalogue's
// order (spec.ts PRESETS, the default first); a palette's word is the catalogue's name
// (spec.ts PALETTE_KNOB); only the layout is the repo's (frozen values).

import {
  validateLook,
  validateLookSchema,
  type ChoiceKnob,
  type LookSchema,
  type NumberKnob,
} from '../../core/web/lib/theme-host/look-schema';
import type { ThemeError } from '../../core/web/lib/theme-host/css-value';
import {
  CANDY_CARDS,
  CANDY_GLOW,
  CANDY_GRADIENTS,
  CANDY_ROUNDNESS,
  type CandyCards,
  type CandyGradient,
} from '../tokens/candy';
import { PALETTES, PALETTE_IDS, type PaletteId } from '../tokens/candy-catalogue';

/** What every Candy look document says it is, and the interface it is for. */
export const CANDY_LOOK_DOCUMENT_SCHEMA = 'candy-look/v1';
export const CANDY_INTERFACE = 'candy';

/** Every knob, in looks/schema.json's order (Make it sweet's rows). */
export const CANDY_KNOBS = Object.freeze([
  'palette',
  'cards',
  'gradient',
  'roundness',
  'glow',
  'motion',
] as const);
export type CandyKnob = (typeof CANDY_KNOBS)[number];

/** spec.ts CHOICE_KNOBS and NUMBER_KNOBS: Glow is the one number knob. */
export type CandyNumberKnob = 'glow';
export type CandyChoiceKnob = Exclude<CandyKnob, CandyNumberKnob>;

/** looks/schema.json's motion choices: the look's own Motion, synced (never the phone's pause). */
export const CANDY_MOTIONS = Object.freeze(['on', 'paused'] as const);
export type CandyMotion = (typeof CANDY_MOTIONS)[number];

/** spec.ts ROUNDNESS_VALUES: the Roundness keys '16' to '40', each a whole number of points. */
export const CANDY_ROUNDNESS_KEYS: readonly string[] = Object.freeze(
  Array.from({ length: CANDY_ROUNDNESS.max - CANDY_ROUNDNESS.min + 1 }, (_, i) =>
    String(CANDY_ROUNDNESS.min + i),
  ),
);

/** A Candy look as a candy-look/v1 document (the knobs in CANDY_KNOBS' order). */
export type CandyLook = {
  readonly schema: typeof CANDY_LOOK_DOCUMENT_SCHEMA;
  readonly interface: typeof CANDY_INTERFACE;
  readonly id: string;
  readonly name: string;
  readonly sub: string;
  readonly palette: PaletteId;
  readonly cards: CandyCards;
  readonly gradient: CandyGradient;
  /** One of CANDY_ROUNDNESS_KEYS ('28'). */
  readonly roundness: string;
  /** A whole number 0–10. */
  readonly glow: number;
  readonly motion: CandyMotion;
};

function choiceKnob(label: string, choices: readonly string[], value: string): ChoiceKnob {
  const frozen = Object.freeze([...choices]);
  return Object.freeze({ kind: 'choice', label, choices: frozen, default: value });
}

function numberKnob(label: string, range: typeof CANDY_GLOW): NumberKnob {
  const { min, max } = range;
  return Object.freeze({ kind: 'number', label, min, max, integer: true, default: range.default });
}

/** looks/schema.json at the pin. */
export const CANDY_LOOK_SCHEMA = Object.freeze({
  schema: 'automatos-look-schema/v1',
  look: Object.freeze({ schema: CANDY_LOOK_DOCUMENT_SCHEMA, interface: CANDY_INTERFACE }),
  knobs: Object.freeze({
    palette: choiceKnob('Palette', PALETTE_IDS, 'blush'),
    cards: choiceKnob('Card colours', CANDY_CARDS, 'mix'),
    gradient: choiceKnob('Gradient', CANDY_GRADIENTS, 'rich'),
    roundness: choiceKnob('Roundness', CANDY_ROUNDNESS_KEYS, String(CANDY_ROUNDNESS.default)),
    glow: numberKnob('Glow', CANDY_GLOW),
    motion: choiceKnob('Motion', CANDY_MOTIONS, 'on'),
  } satisfies Record<CandyChoiceKnob, ChoiceKnob> & Record<CandyNumberKnob, NumberKnob>),
});

type PresetValues = Omit<CandyLook, 'schema' | 'interface'>;

/** A looks/presets/*.look.json file: the schema and interface every look names, then its values. */
function presetFile(values: PresetValues): CandyLook {
  return Object.freeze({
    schema: CANDY_LOOK_DOCUMENT_SCHEMA,
    interface: CANDY_INTERFACE,
    ...values,
  });
}

/** The three presets, ids, names and lines as the kit has them. */
export const CANDY_PRESET_LOOKS: readonly CandyLook[] = Object.freeze([
  presetFile({
    id: 'blush',
    name: 'Blush',
    sub: 'Pink on white, mixed cards',
    palette: 'blush',
    cards: 'mix',
    gradient: 'rich',
    roundness: '28',
    glow: 6,
    motion: 'on',
  }),
  presetFile({
    id: 'lilac',
    name: 'Lilac',
    sub: 'Violet into blue, airy',
    palette: 'lilac',
    cards: 'mix',
    gradient: 'vivid',
    roundness: '32',
    glow: 5,
    motion: 'on',
  }),
  presetFile({
    id: 'nightbloom',
    name: 'Night bloom',
    sub: 'Neon pinks after dark',
    palette: 'nightbloom',
    cards: 'mix',
    gradient: 'vivid',
    roundness: '28',
    glow: 8,
    motion: 'on',
  }),
]);

/** theme.json's look: Blush, where a new phone and a deleted active look land. */
export const CANDY_DEFAULT_PRESET_ID = 'blush';

function presetLook(id: string): CandyLook {
  const found = CANDY_PRESET_LOOKS.find((look) => look.id === id);
  if (!found) throw new Error(`Candy's looks have no preset ${id}`);
  return found;
}

export const CANDY_DEFAULT_LOOK: CandyLook = presetLook(CANDY_DEFAULT_PRESET_ID);

/** spec.ts KNOBS: the word Make it sweet shows for each choice (a palette's: the catalogue's name). */
export const CANDY_CHOICE_WORDS = Object.freeze({
  palette: Object.freeze<Record<string, string>>(
    Object.fromEntries(PALETTES.map((palette) => [palette.id, palette.name])),
  ),
  cards: Object.freeze<Record<string, string>>({ mix: 'Mixed', single: 'One colour' }),
  gradient: Object.freeze<Record<string, string>>({ soft: 'Soft', rich: 'Rich', vivid: 'Vivid' }),
  motion: Object.freeze<Record<string, string>>({ on: 'On', paused: 'Paused' }),
});

/** spec.ts GRADIENT_NOTES: what Make it sweet says under the Gradient row, per choice. */
export const CANDY_GRADIENT_NOTES: Readonly<Record<CandyGradient, string>> = Object.freeze({
  soft: 'One hue per card',
  rich: 'Hues blend card to card',
  vivid: 'Blends, glows and aura',
});

/** CANDY_LOOK_SCHEMA as the vendored validator checks it; a refused schema fails the tests. */
function checkedSchema(): LookSchema {
  const { schema, errors } = validateLookSchema(CANDY_LOOK_SCHEMA);
  if (schema === null) {
    throw new Error(`Candy's look schema is refused: ${errors.map((e) => e.message).join(' ')}`);
  }
  return schema;
}

export const CANDY_LOOK_SPEC: LookSchema = checkedSchema();

/** Every reason `look` is not a Candy look (the vendored validateLook); empty when it is one. */
export function candyLookErrors(look: unknown): readonly ThemeError[] {
  return validateLook(CANDY_LOOK_SPEC, look);
}

export function isCandyLook(look: unknown): look is CandyLook {
  return candyLookErrors(look).length === 0;
}

export function candyChoiceSpec(knob: CandyChoiceKnob): ChoiceKnob {
  return CANDY_LOOK_SCHEMA.knobs[knob];
}

export function candyNumberSpec(knob: CandyNumberKnob): NumberKnob {
  return CANDY_LOOK_SCHEMA.knobs[knob];
}
