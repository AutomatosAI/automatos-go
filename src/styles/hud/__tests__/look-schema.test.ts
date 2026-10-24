// HUD's look schema against looks.json and the vendored validators (KS8): the schema passes
// validateLookSchema, every knob as looks.json declares it with ARC's defaults, every preset
// converts and passes validateLook, v0 → v1 → v0 is the identity, and what validateLook refuses.

import { describe, expect, it } from 'vitest';

import {
  LOOK_SCHEMA_SCHEMA,
  validateLook,
  validateLookSchema,
} from '../../../core/web/lib/theme-host/look-schema';
import {
  HUD_ACCENT_KEYS,
  HUD_DEFAULT_PRESET_ID,
  HUD_FONT_KEYS,
  HUD_GROUND_KEYS,
  HUD_PRESETS,
} from '../../tokens/hud-catalogue';
import {
  HUD_DEFAULT_LOOK,
  HUD_KNOBS,
  HUD_LOOK_SCHEMA,
  HUD_LOOK_SPEC,
  HUD_PRESET_LOOKS,
  fromV0,
  hudLookErrors,
  isHudLook,
  toV0,
} from '../look-schema';

const ON_OFF = ['on', 'off'];

describe("HUD's look schema (automatos-look-schema/v1)", () => {
  it('passes the vendored validateLookSchema with no errors', () => {
    const { schema, errors } = validateLookSchema(HUD_LOOK_SCHEMA);
    expect(errors).toEqual([]);
    expect(schema?.lookSchema).toBe('automatos-interface-look/v1');
    expect(schema?.interface).toBe('command');
    expect(HUD_LOOK_SCHEMA.schema).toBe(LOOK_SCHEMA_SCHEMA);
    expect(HUD_LOOK_SPEC.knobs.size).toBe(8);
  });

  it('declares the knobs looks.json has, labelled for the drawer, ARC every default', () => {
    expect(HUD_LOOK_SCHEMA).toEqual({
      schema: 'automatos-look-schema/v1',
      look: { schema: 'automatos-interface-look/v1', interface: 'command' },
      knobs: {
        ground: {
          kind: 'choice',
          label: 'Background',
          choices: ['void', 'carbon', 'navy', 'ember'],
          default: 'void',
        },
        accent: {
          kind: 'choice',
          label: 'Accent',
          choices: ['arc', 'forge', 'ghost', 'nova', 'signal', 'gold'],
          default: 'arc',
        },
        font: { kind: 'choice', label: 'Type', choices: ['raj', 'chakra', 'mono'], default: 'raj' },
        grid: { kind: 'number', label: 'Grid', min: 0, max: 30, integer: true, default: 14 },
        glow: { kind: 'number', label: 'Glow', min: 0, max: 40, integer: true, default: 22 },
        scan: { kind: 'choice', label: 'Scanlines', choices: ON_OFF, default: 'on' },
        auto: { kind: 'choice', label: 'Auto', choices: ON_OFF, default: 'on' },
        motion: { kind: 'choice', label: 'Motion', choices: ON_OFF, default: 'on' },
      },
    });
    expect(Object.keys(HUD_LOOK_SCHEMA.knobs)).toEqual([...HUD_KNOBS]);
  });

  it("takes its choices from HUD's catalogue, so a new option is one edit", () => {
    expect(HUD_LOOK_SCHEMA.knobs.ground).toMatchObject({ choices: HUD_GROUND_KEYS });
    expect(HUD_LOOK_SCHEMA.knobs.accent).toMatchObject({ choices: HUD_ACCENT_KEYS });
    expect(HUD_LOOK_SCHEMA.knobs.font).toMatchObject({ choices: HUD_FONT_KEYS });
  });

  it("is ARC by default (looks.json 'default': 'arc')", () => {
    expect(HUD_DEFAULT_PRESET_ID).toBe('arc');
    expect(HUD_DEFAULT_LOOK.id).toBe('arc');
    for (const knob of HUD_KNOBS) {
      expect(HUD_LOOK_SCHEMA.knobs[knob].default).toBe(HUD_DEFAULT_LOOK[knob]);
    }
  });
});

describe('the v0 conversion', () => {
  it('converts the five looks.json presets to HUD looks', () => {
    expect(HUD_PRESET_LOOKS.map((look) => [look.id, look.name])).toEqual([
      ['arc', 'ARC'],
      ['forge', 'FORGE'],
      ['ghost', 'GHOST'],
      ['nova', 'NOVA'],
      ['signal', 'SIGNAL'],
    ]);
    expect(HUD_PRESET_LOOKS[1]).toEqual({
      schema: 'automatos-interface-look/v1',
      interface: 'command',
      id: 'forge',
      name: 'FORGE',
      sub: '',
      ground: 'ember',
      accent: 'forge',
      font: 'chakra',
      grid: 8,
      glow: 26,
      scan: 'off',
      auto: 'on',
      motion: 'on',
    });
  });

  it('every preset passes the vendored validateLook against the HUD schema with no errors', () => {
    for (const look of HUD_PRESET_LOOKS) {
      expect(validateLook(HUD_LOOK_SPEC, look)).toEqual([]);
      expect(isHudLook(look)).toBe(true);
    }
  });

  it('maps booleans to on / off and back', () => {
    const ghost = HUD_PRESETS.find((look) => look.id === 'ghost');
    if (!ghost) throw new Error('looks.json has GHOST');
    const v1 = fromV0(ghost);
    expect([v1.scan, v1.auto, v1.motion]).toEqual(['off', 'off', 'on']);
    expect(toV0(v1)).toMatchObject({ scan: false, auto: false, motion: true });
  });

  it('round-trips v0 → v1 → v0 as the identity, schema, interface and sub removed', () => {
    for (const preset of HUD_PRESETS) {
      const back = toV0(fromV0(preset));
      expect(back).toEqual(preset);
      expect(Object.keys(back).sort()).toEqual(Object.keys(preset).sort());
    }
  });

  it('round-trips v1 → v0 → v1 for a look with no sub', () => {
    for (const look of HUD_PRESET_LOOKS) expect(fromV0(toV0(look))).toEqual(look);
  });
});

describe('what the vendored validateLook refuses', () => {
  const arc = HUD_DEFAULT_LOOK;
  const codes = (look: unknown) => hudLookErrors(look).map((error) => error.code);

  it('refuses a v0 preset as it stands (booleans, no schema)', () => {
    expect(isHudLook(HUD_PRESETS[0])).toBe(false);
  });

  it('refuses values outside a knob', () => {
    expect(codes({ ...arc, grid: 31 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...arc, glow: 12.5 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...arc, accent: 'teal' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...arc, scan: true })).toEqual(['LOOK_BAD_VALUE']);
  });

  it("refuses another schema or interface, a bad id or name, and a look's unknown fields", () => {
    expect(codes({ ...arc, schema: 'automatos-interface-look/v0' })).toEqual(['LOOK_WRONG_SCHEMA']);
    expect(codes({ ...arc, interface: 'play' })).toEqual(['LOOK_WRONG_SCHEMA']);
    expect(codes({ ...arc, id: '../arc' })).toEqual(['LOOK_BAD_ID']);
    expect(codes({ ...arc, name: '   ' })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...arc, name: 'x'.repeat(41) })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...arc, colour: 'red' })).toEqual(['LOOK_UNKNOWN_FIELD']);
    expect(codes(null)).toEqual(['LOOK_NOT_AN_OBJECT']);
  });
});
