// HUD's looks in the Design Kit's shape (PRD-001 §4.6, KS8): looks.json
// (automatos-interface-look/v0) as an 'automatos-look-schema/v1' document, so HUD can become a
// theme later without rework. The v1 schema has no boolean knob (the vendored KNOB_KINDS are
// choice and number), so looks.json's switches scan, auto and motion are 'on' / 'off' choices;
// fromV0 / toV0 convert a looks.json preset and back. Everything is checked with the vendored
// validateLookSchema / validateLook (lib/theme-host/look-schema.ts, the server's own rules),
// never a second validator. Pure.

import {
  validateLook,
  validateLookSchema,
  type LookKnob,
  type LookSchema,
} from '../../core/web/lib/theme-host/look-schema';
import type { ThemeError } from '../../core/web/lib/theme-host/css-value';
import { HUD_LOOK_COPY } from '../strings';
import {
  HUD_ACCENT_KEYS,
  HUD_DEFAULT_PRESET_ID,
  HUD_FONT_KEYS,
  HUD_GLOW_RANGE,
  HUD_GRID_RANGE,
  HUD_GROUND_KEYS,
  HUD_PRESETS,
  type HudAccentKey,
  type HudFontKey,
  type HudGroundKey,
  type HudPreset,
} from '../tokens/hud-catalogue';

/** What every HUD look document says it is, and the interface it is for. */
export const HUD_LOOK_DOCUMENT_SCHEMA = 'automatos-interface-look/v1';
export const HUD_INTERFACE = 'command';

/** looks.json's booleans as v1 choices. */
export const HUD_SWITCH_CHOICES = Object.freeze(['on', 'off'] as const);
export type HudSwitch = (typeof HUD_SWITCH_CHOICES)[number];

/** Every knob, in the drawer's order. */
export const HUD_KNOBS = Object.freeze([
  'ground',
  'accent',
  'font',
  'grid',
  'glow',
  'scan',
  'auto',
  'motion',
] as const);
export type HudKnob = (typeof HUD_KNOBS)[number];

/** A HUD look as an automatos-interface-look/v1 document (the knobs in HUD_KNOBS' order). */
export type HudLook = {
  readonly schema: typeof HUD_LOOK_DOCUMENT_SCHEMA;
  readonly interface: typeof HUD_INTERFACE;
  readonly id: string;
  readonly name: string;
  readonly sub: string;
  readonly ground: HudGroundKey;
  readonly accent: HudAccentKey;
  readonly font: HudFontKey;
  readonly grid: number;
  readonly glow: number;
  readonly scan: HudSwitch;
  readonly auto: HudSwitch;
  readonly motion: HudSwitch;
};

function onOff(value: boolean): HudSwitch {
  return value ? 'on' : 'off';
}

/** A looks.json preset as a v1 look: switches 'on' / 'off'; schema, interface, sub '' added. */
export function fromV0(look: HudPreset): HudLook {
  return Object.freeze({
    schema: HUD_LOOK_DOCUMENT_SCHEMA,
    interface: HUD_INTERFACE,
    id: look.id,
    name: look.name,
    sub: '',
    ground: look.ground,
    accent: look.accent,
    font: look.font,
    grid: look.grid,
    glow: look.glow,
    scan: onOff(look.scan),
    auto: onOff(look.auto),
    motion: onOff(look.motion),
  });
}

/** A v1 look back as looks.json writes one: booleans again; schema, interface and sub removed. */
export function toV0(look: HudLook): HudPreset {
  return Object.freeze({
    id: look.id,
    name: look.name,
    ground: look.ground,
    accent: look.accent,
    font: look.font,
    grid: look.grid,
    glow: look.glow,
    scan: look.scan === 'on',
    auto: look.auto === 'on',
    motion: look.motion === 'on',
  });
}

/** looks.json's five presets as v1 looks, in its order (ARC, FORGE, GHOST, NOVA, SIGNAL). */
export const HUD_PRESET_LOOKS: readonly HudLook[] = Object.freeze(HUD_PRESETS.map(fromV0));

function presetLook(id: string): HudLook {
  const found = HUD_PRESET_LOOKS.find((look) => look.id === id);
  if (!found) throw new Error(`looks.json has no preset ${id}`);
  return found;
}

/** looks.json 'default': ARC, where a new phone and a deleted active look land. */
export const HUD_DEFAULT_LOOK: HudLook = presetLook(HUD_DEFAULT_PRESET_ID);

/** The knobs that are whole numbers; every other knob is a choice. */
export type HudNumberKnob = 'grid' | 'glow';
export type HudChoiceKnob = Exclude<HudKnob, HudNumberKnob>;

type Range = { readonly min: number; readonly max: number };

function choiceKnob(knob: HudChoiceKnob, choices: readonly string[]): LookKnob {
  const label = HUD_LOOK_COPY.knobs[knob];
  return Object.freeze({ kind: 'choice', label, choices, default: HUD_DEFAULT_LOOK[knob] });
}

function numberKnob(knob: HudNumberKnob, { min, max }: Range): LookKnob {
  const label = HUD_LOOK_COPY.knobs[knob];
  const value = HUD_DEFAULT_LOOK[knob];
  return Object.freeze({ kind: 'number', label, min, max, integer: true, default: value });
}

/** HUD's looks/schema.json: the knobs looks.json declares, every default ARC's value. */
export const HUD_LOOK_SCHEMA = Object.freeze({
  schema: 'automatos-look-schema/v1',
  look: Object.freeze({ schema: HUD_LOOK_DOCUMENT_SCHEMA, interface: HUD_INTERFACE }),
  knobs: Object.freeze({
    ground: choiceKnob('ground', HUD_GROUND_KEYS),
    accent: choiceKnob('accent', HUD_ACCENT_KEYS),
    font: choiceKnob('font', HUD_FONT_KEYS),
    grid: numberKnob('grid', HUD_GRID_RANGE),
    glow: numberKnob('glow', HUD_GLOW_RANGE),
    scan: choiceKnob('scan', HUD_SWITCH_CHOICES),
    auto: choiceKnob('auto', HUD_SWITCH_CHOICES),
    motion: choiceKnob('motion', HUD_SWITCH_CHOICES),
  } satisfies Record<HudKnob, LookKnob>),
});

/** HUD_LOOK_SCHEMA as the vendored validator checks it; a refused schema fails the tests. */
function checkedSchema(): LookSchema {
  const { schema, errors } = validateLookSchema(HUD_LOOK_SCHEMA);
  if (schema === null) {
    throw new Error(`HUD's look schema is refused: ${errors.map((e) => e.message).join(' ')}`);
  }
  return schema;
}

export const HUD_LOOK_SPEC: LookSchema = checkedSchema();

/** Every reason `look` is not a HUD look (the vendored validateLook); empty when it is one. */
export function hudLookErrors(look: unknown): readonly ThemeError[] {
  return validateLook(HUD_LOOK_SPEC, look);
}

export function isHudLook(look: unknown): look is HudLook {
  return hudLookErrors(look).length === 0;
}

export function hudKnobSpec(knob: HudKnob): LookKnob {
  return HUD_LOOK_SCHEMA.knobs[knob];
}
