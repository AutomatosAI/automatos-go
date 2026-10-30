// Arcade's look schema against the design kit's looks/schema.json and presets at 034fa629c and the
// vendored validators (D-ARC-3): the schema passes validateLookSchema, every knob as the kit
// declares it with Overworld's defaults, the five presets as the kit's files have them, each
// passing validateLook and matching its palette in the catalogue, and what validateLook refuses.

import { describe, expect, it } from 'vitest';

import {
  LOOK_SCHEMA_SCHEMA,
  validateLook,
  validateLookSchema,
} from '../../../core/web/lib/theme-host/look-schema';
import {
  ARCADE_DEFAULT_PICKS,
  ARCADE_PIXEL_SCALES,
  ARCADE_WINDOW_STYLES,
  type ArcadePaintPicks,
} from '../../tokens/arcade';
import { PALETTES, PALETTE_IDS, SCAN_ALPHA } from '../../tokens/arcade-catalogue';
import {
  ARCADE_DEFAULT_LOOK,
  ARCADE_DEFAULT_PRESET_ID,
  ARCADE_KNOBS,
  ARCADE_LOOK_SCHEMA,
  ARCADE_LOOK_SPEC,
  ARCADE_PRESET_LOOKS,
  ARCADE_TEXT_SPEEDS,
  arcadeKnobSpec,
  arcadeLookErrors,
  isArcadeLook,
} from '../look-schema';

/** A preset file's fields, in its order. */
const PRESET_FIELDS = ['schema', 'interface', 'id', 'name', 'sub', ...ARCADE_KNOBS];

describe("Arcade's look schema (automatos-look-schema/v1)", () => {
  it('passes the vendored validateLookSchema with no errors', () => {
    const { schema, errors } = validateLookSchema(ARCADE_LOOK_SCHEMA);
    expect(errors).toEqual([]);
    expect(schema?.lookSchema).toBe('arcade-look/v1');
    expect(schema?.interface).toBe('arcade');
    expect(ARCADE_LOOK_SCHEMA.schema).toBe(LOOK_SCHEMA_SCHEMA);
    expect(ARCADE_LOOK_SPEC.knobs.size).toBe(5);
  });

  it('is looks/schema.json at the pin: five choice knobs, their labels and defaults', () => {
    expect(ARCADE_LOOK_SCHEMA).toEqual({
      schema: 'automatos-look-schema/v1',
      look: { schema: 'arcade-look/v1', interface: 'arcade' },
      knobs: {
        palette: {
          kind: 'choice',
          label: 'Palette',
          choices: ['overworld', 'dungeon', 'neon', 'nightcity', 'handheld'],
          default: 'overworld',
        },
        scanlines: {
          kind: 'choice',
          label: 'Scanlines',
          choices: ['off', 'soft', 'strong'],
          default: 'soft',
        },
        pixelScale: { kind: 'choice', label: 'Pixel scale', choices: ['2', '3'], default: '3' },
        windowStyle: {
          kind: 'choice',
          label: 'Window',
          choices: ['classic', 'thin'],
          default: 'classic',
        },
        textSpeed: {
          kind: 'choice',
          label: 'Text speed',
          choices: ['instant', 'normal', 'slow'],
          default: 'normal',
        },
      },
    });
    expect(Object.keys(ARCADE_LOOK_SCHEMA.knobs)).toEqual([...ARCADE_KNOBS]);
  });

  it("offers the catalogue's palettes and scanlines and the tokens' window and pixel choices", () => {
    expect(arcadeKnobSpec('palette').choices).toEqual([...PALETTE_IDS]);
    expect(arcadeKnobSpec('scanlines').choices).toEqual(Object.keys(SCAN_ALPHA.dark));
    expect(arcadeKnobSpec('windowStyle').choices).toEqual([...ARCADE_WINDOW_STYLES]);
    expect(arcadeKnobSpec('pixelScale').choices).toEqual([...ARCADE_PIXEL_SCALES]);
    expect(arcadeKnobSpec('textSpeed').choices).toEqual([...ARCADE_TEXT_SPEEDS]);
  });

  it("is Overworld by default (theme.json's look), every knob default its value", () => {
    expect(ARCADE_DEFAULT_PRESET_ID).toBe('overworld');
    expect(ARCADE_DEFAULT_LOOK.id).toBe('overworld');
    for (const knob of ARCADE_KNOBS) {
      expect(arcadeKnobSpec(knob).default).toBe(ARCADE_DEFAULT_LOOK[knob]);
    }
  });

  it("paints what the tokens' default picks paint", () => {
    const picks: ArcadePaintPicks = ARCADE_DEFAULT_LOOK;
    const { palette, scanlines, windowStyle, pixelScale } = picks;
    expect({ palette, scanlines, windowStyle, pixelScale }).toEqual(ARCADE_DEFAULT_PICKS);
  });
});

describe('the five presets (looks/presets/*.look.json)', () => {
  it('has the ids and names the kit has, in the catalogue order', () => {
    expect(ARCADE_PRESET_LOOKS.map((look) => [look.id, look.name])).toEqual([
      ['overworld', 'Overworld'],
      ['dungeon', 'Dungeon'],
      ['neon', 'Neon Cabinet'],
      ['nightcity', 'Night City'],
      ['handheld', 'Handheld'],
    ]);
  });

  it('is each file as the kit has it', () => {
    expect(ARCADE_PRESET_LOOKS[2]).toEqual({
      schema: 'arcade-look/v1',
      interface: 'arcade',
      id: 'neon',
      name: 'Neon Cabinet',
      sub: 'Magenta and cyan, strong scanlines',
      palette: 'neon',
      scanlines: 'strong',
      pixelScale: '3',
      windowStyle: 'classic',
      textSpeed: 'normal',
    });
    for (const look of ARCADE_PRESET_LOOKS) {
      expect(Object.keys(look)).toEqual(PRESET_FIELDS);
    }
  });

  it("matches its palette in the catalogue: id, name, line and the palette's own scanlines", () => {
    expect(ARCADE_PRESET_LOOKS).toHaveLength(PALETTES.length);
    PALETTES.forEach((palette, i) => {
      const look = ARCADE_PRESET_LOOKS[i];
      expect(look).toMatchObject({
        id: palette.id,
        name: palette.name,
        sub: palette.sub,
        palette: palette.id,
        scanlines: palette.scanlines,
        pixelScale: '3',
        windowStyle: 'classic',
        textSpeed: 'normal',
      });
    });
  });

  it('every preset passes the vendored validateLook against the Arcade schema with no errors', () => {
    for (const look of ARCADE_PRESET_LOOKS) {
      expect(validateLook(ARCADE_LOOK_SPEC, look)).toEqual([]);
      expect(isArcadeLook(look)).toBe(true);
      expect(Object.isFrozen(look)).toBe(true);
    }
  });
});

describe('what the vendored validateLook refuses', () => {
  const overworld = ARCADE_DEFAULT_LOOK;
  const codes = (look: unknown) => arcadeLookErrors(look).map((error) => error.code);

  it('refuses values outside a knob', () => {
    expect(codes({ ...overworld, palette: 'forest' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...overworld, scanlines: 'medium' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...overworld, pixelScale: 3 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...overworld, windowStyle: 'double' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...overworld, textSpeed: 'fast' })).toEqual(['LOOK_BAD_VALUE']);
  });

  it("refuses HUD's and Play's documents, a bad id or name, and a look's unknown fields", () => {
    expect(codes({ ...overworld, schema: 'automatos-interface-look/v1' })).toEqual([
      'LOOK_WRONG_SCHEMA',
    ]);
    expect(codes({ ...overworld, interface: 'command' })).toEqual(['LOOK_WRONG_SCHEMA']);
    expect(codes({ ...overworld, id: '../overworld' })).toEqual(['LOOK_BAD_ID']);
    expect(codes({ ...overworld, name: '   ' })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...overworld, sub: 'x'.repeat(41) })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...overworld, colour: 'red' })).toEqual(['LOOK_UNKNOWN_FIELD']);
    expect(codes(null)).toEqual(['LOOK_NOT_AN_OBJECT']);
  });

  it('takes an empty line under the name', () => {
    expect(isArcadeLook({ ...overworld, sub: '' })).toBe(true);
  });
});
