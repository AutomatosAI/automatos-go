// Arcade's looks in the web's own shape (PRD-001 §4.6.1, D-ARC-3, KA3-VENDOR-PIN): the design
// kit's looks/schema.json ('automatos-look-schema/v1'; look schema 'arcade-look/v1', interface
// 'arcade'; the five knobs, each a choice, with the kit's labels and defaults) and its five
// presets, one per palette, copied as data. The schema is checked at load by the vendored
// validateLookSchema and every look by the vendored validateLook (lib/theme-host/look-schema.ts,
// the server's own rules), never a second validator. Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit at 034fa629c (034fa629c8ba79cff042559ca2d132f6d38f6d23),
// each file under themes/arcade/ with its sha256:
//   looks/schema.json
//     1e5a24cd1fe21a5b3a3b9aa672b7b99f19f52d9a35194199891e46f106e215b6
//   looks/presets/overworld.look.json
//     62c18b695b6ab6ba491df837ea24eedfcb48ae8604b183189ef19af87743cec2
//   looks/presets/dungeon.look.json
//     55788f4d7cd0156043b956e9da2f012f200ce467c1c1e590f2e27e40276f9d4f
//   looks/presets/neon.look.json
//     165e322d93d06f2418e3bb43186f6d86ce2ca47e9e7afb440cf6bc9063a57e0f
//   looks/presets/nightcity.look.json
//     32673588e89fed457472d32dde34da009117e5985e57e747cff9584d467bb6e0
//   looks/presets/handheld.look.json
//     8eb7011648d2fe4ac4edb3d607be07edaf3ba18e9f664ad070c4b988d02d3489
// Values are copied, never retuned: a change starts there. The presets are in the catalogue's
// order (spec.ts PRESETS, the default first); only the layout is the repo's (frozen values).

import {
  validateLook,
  validateLookSchema,
  type ChoiceKnob,
  type LookSchema,
} from '../../core/web/lib/theme-host/look-schema';
import type { ThemeError } from '../../core/web/lib/theme-host/css-value';
import type { PaletteId, ScanlineId } from '../tokens/arcade-catalogue';
import type { ArcadePixelScale, ArcadeWindowStyle } from '../tokens/arcade';

/** What every Arcade look document says it is, and the interface it is for. */
export const ARCADE_LOOK_DOCUMENT_SCHEMA = 'arcade-look/v1';
export const ARCADE_INTERFACE = 'arcade';

/** Every knob, in looks/schema.json's order (the Options screen's rows). */
export const ARCADE_KNOBS = Object.freeze([
  'palette',
  'scanlines',
  'pixelScale',
  'windowStyle',
  'textSpeed',
] as const);
export type ArcadeKnob = (typeof ARCADE_KNOBS)[number];

/** looks/schema.json's textSpeed choices. */
export const ARCADE_TEXT_SPEEDS = Object.freeze(['instant', 'normal', 'slow'] as const);
export type ArcadeTextSpeed = (typeof ARCADE_TEXT_SPEEDS)[number];

/** An Arcade look as an arcade-look/v1 document (the knobs in ARCADE_KNOBS' order). */
export type ArcadeLook = {
  readonly schema: typeof ARCADE_LOOK_DOCUMENT_SCHEMA;
  readonly interface: typeof ARCADE_INTERFACE;
  readonly id: string;
  readonly name: string;
  readonly sub: string;
  readonly palette: PaletteId;
  readonly scanlines: ScanlineId;
  readonly pixelScale: ArcadePixelScale;
  readonly windowStyle: ArcadeWindowStyle;
  readonly textSpeed: ArcadeTextSpeed;
};

function choiceKnob(label: string, choices: readonly string[], value: string): ChoiceKnob {
  const frozen = Object.freeze([...choices]);
  return Object.freeze({ kind: 'choice', label, choices: frozen, default: value });
}

/** looks/schema.json at the pin. */
export const ARCADE_LOOK_SCHEMA = Object.freeze({
  schema: 'automatos-look-schema/v1',
  look: Object.freeze({ schema: ARCADE_LOOK_DOCUMENT_SCHEMA, interface: ARCADE_INTERFACE }),
  knobs: Object.freeze({
    palette: choiceKnob(
      'Palette',
      ['overworld', 'dungeon', 'neon', 'nightcity', 'handheld'],
      'overworld',
    ),
    scanlines: choiceKnob('Scanlines', ['off', 'soft', 'strong'], 'soft'),
    pixelScale: choiceKnob('Pixel scale', ['2', '3'], '3'),
    windowStyle: choiceKnob('Window', ['classic', 'thin'], 'classic'),
    textSpeed: choiceKnob('Text speed', ['instant', 'normal', 'slow'], 'normal'),
  } satisfies Record<ArcadeKnob, ChoiceKnob>),
});

type PresetValues = Omit<ArcadeLook, 'schema' | 'interface'>;

/** A looks/presets/*.look.json file: the schema and interface every look names, then its values. */
function presetFile(values: PresetValues): ArcadeLook {
  return Object.freeze({
    schema: ARCADE_LOOK_DOCUMENT_SCHEMA,
    interface: ARCADE_INTERFACE,
    ...values,
  });
}

/** The five presets, ids and names as the kit has them. */
export const ARCADE_PRESET_LOOKS: readonly ArcadeLook[] = Object.freeze([
  presetFile({
    id: 'overworld',
    name: 'Overworld',
    sub: 'Night forest, grass-green accent',
    palette: 'overworld',
    scanlines: 'soft',
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }),
  presetFile({
    id: 'dungeon',
    name: 'Dungeon',
    sub: 'Stone and purple, torch-orange accent',
    palette: 'dungeon',
    scanlines: 'soft',
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }),
  presetFile({
    id: 'neon',
    name: 'Neon Cabinet',
    sub: 'Magenta and cyan, strong scanlines',
    palette: 'neon',
    scanlines: 'strong',
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }),
  presetFile({
    id: 'nightcity',
    name: 'Night City',
    sub: 'Navy rain, sodium-amber accent',
    palette: 'nightcity',
    scanlines: 'soft',
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }),
  presetFile({
    id: 'handheld',
    name: 'Handheld',
    sub: 'Four shades of an olive screen',
    palette: 'handheld',
    scanlines: 'soft',
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }),
]);

/** theme.json's look: Overworld, where a new phone and a deleted active look land. */
export const ARCADE_DEFAULT_PRESET_ID = 'overworld';

function presetLook(id: string): ArcadeLook {
  const found = ARCADE_PRESET_LOOKS.find((look) => look.id === id);
  if (!found) throw new Error(`Arcade's looks have no preset ${id}`);
  return found;
}

export const ARCADE_DEFAULT_LOOK: ArcadeLook = presetLook(ARCADE_DEFAULT_PRESET_ID);

/** ARCADE_LOOK_SCHEMA as the vendored validator checks it; a refused schema fails the tests. */
function checkedSchema(): LookSchema {
  const { schema, errors } = validateLookSchema(ARCADE_LOOK_SCHEMA);
  if (schema === null) {
    throw new Error(`Arcade's look schema is refused: ${errors.map((e) => e.message).join(' ')}`);
  }
  return schema;
}

export const ARCADE_LOOK_SPEC: LookSchema = checkedSchema();

/** Every reason `look` is not an Arcade look (the vendored validateLook); empty when it is one. */
export function arcadeLookErrors(look: unknown): readonly ThemeError[] {
  return validateLook(ARCADE_LOOK_SPEC, look);
}

export function isArcadeLook(look: unknown): look is ArcadeLook {
  return arcadeLookErrors(look).length === 0;
}

export function arcadeKnobSpec(knob: ArcadeKnob): ChoiceKnob {
  return ARCADE_LOOK_SCHEMA.knobs[knob];
}
