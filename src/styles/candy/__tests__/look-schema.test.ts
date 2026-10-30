// Candy's look schema against the design kit's looks/schema.json, presets and spec.ts at 3920359d5
// and the vendored validators (D-CAN-3): the schema passes validateLookSchema with its number knob,
// every knob as the kit declares it with Blush's defaults, the three presets as the kit's files have
// them, each passing validateLook and matching its palette in the catalogue, spec.ts's choice words
// and Gradient notes, and what validateLook refuses (roundness '41', glow 6.5, palette 'mint').

import { describe, expect, it } from 'vitest';

import {
  LOOK_SCHEMA_SCHEMA,
  validateLook,
  validateLookSchema,
} from '../../../core/web/lib/theme-host/look-schema';
import { CANDY_CARDS, CANDY_DEFAULT_PICKS, CANDY_GRADIENTS } from '../../tokens/candy';
import { PALETTES, PALETTE_IDS } from '../../tokens/candy-catalogue';
import {
  CANDY_CHOICE_WORDS,
  CANDY_DEFAULT_LOOK,
  CANDY_DEFAULT_PRESET_ID,
  CANDY_GRADIENT_NOTES,
  CANDY_KNOBS,
  CANDY_LOOK_SCHEMA,
  CANDY_LOOK_SPEC,
  CANDY_MOTIONS,
  CANDY_PRESET_LOOKS,
  CANDY_ROUNDNESS_KEYS,
  candyChoiceSpec,
  candyLookErrors,
  candyNumberSpec,
  isCandyLook,
  type CandyLook,
} from '../look-schema';

/** A preset file's fields, in its order. */
const PRESET_FIELDS = ['schema', 'interface', 'id', 'name', 'sub', ...CANDY_KNOBS];

/** looks/schema.json's roundness choices at the pin, written out. */
const KIT_ROUNDNESS = [
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
];

describe("Candy's look schema (automatos-look-schema/v1)", () => {
  it('passes the vendored validateLookSchema with no errors, Glow its one number knob', () => {
    const { schema, errors } = validateLookSchema(CANDY_LOOK_SCHEMA);
    expect(errors).toEqual([]);
    expect(schema?.lookSchema).toBe('candy-look/v1');
    expect(schema?.interface).toBe('candy');
    expect(CANDY_LOOK_SCHEMA.schema).toBe(LOOK_SCHEMA_SCHEMA);
    expect(CANDY_LOOK_SPEC.knobs.size).toBe(6);
    expect(CANDY_LOOK_SPEC.knobs.get('glow')?.kind).toBe('number');
  });

  it('is looks/schema.json at the pin: six knobs, their labels and defaults', () => {
    expect(CANDY_LOOK_SCHEMA).toEqual({
      schema: 'automatos-look-schema/v1',
      look: { schema: 'candy-look/v1', interface: 'candy' },
      knobs: {
        palette: {
          kind: 'choice',
          label: 'Palette',
          choices: ['blush', 'lilac', 'nightbloom'],
          default: 'blush',
        },
        cards: {
          kind: 'choice',
          label: 'Card colours',
          choices: ['mix', 'single'],
          default: 'mix',
        },
        gradient: {
          kind: 'choice',
          label: 'Gradient',
          choices: ['soft', 'rich', 'vivid'],
          default: 'rich',
        },
        roundness: { kind: 'choice', label: 'Roundness', choices: KIT_ROUNDNESS, default: '28' },
        glow: { kind: 'number', label: 'Glow', min: 0, max: 10, integer: true, default: 6 },
        motion: { kind: 'choice', label: 'Motion', choices: ['on', 'paused'], default: 'on' },
      },
    });
    expect(Object.keys(CANDY_LOOK_SCHEMA.knobs)).toEqual([...CANDY_KNOBS]);
  });

  it("offers the catalogue's palettes and the tokens' cards, gradients and corners", () => {
    expect(candyChoiceSpec('palette').choices).toEqual([...PALETTE_IDS]);
    expect(candyChoiceSpec('cards').choices).toEqual([...CANDY_CARDS]);
    expect(candyChoiceSpec('gradient').choices).toEqual([...CANDY_GRADIENTS]);
    expect(candyChoiceSpec('roundness').choices).toEqual(CANDY_ROUNDNESS_KEYS);
    expect(candyChoiceSpec('motion').choices).toEqual([...CANDY_MOTIONS]);
    expect(candyNumberSpec('glow')).toMatchObject({ min: 0, max: 10, integer: true });
  });

  it("is Blush by default (theme.json's look), every knob default its value", () => {
    expect(CANDY_DEFAULT_PRESET_ID).toBe('blush');
    expect(CANDY_DEFAULT_LOOK.id).toBe('blush');
    for (const knob of CANDY_KNOBS) {
      const spec = knob === 'glow' ? candyNumberSpec(knob) : candyChoiceSpec(knob);
      expect(spec.default).toBe(CANDY_DEFAULT_LOOK[knob]);
    }
  });

  it("paints what the tokens' default picks paint", () => {
    const { palette, cards, gradient, roundness, glow } = CANDY_DEFAULT_LOOK;
    expect({ palette, cards, gradient, roundness, glow }).toEqual(CANDY_DEFAULT_PICKS);
  });
});

describe('the three presets (looks/presets/*.look.json)', () => {
  it('is each file as the kit has it', () => {
    expect(CANDY_PRESET_LOOKS).toEqual([
      {
        schema: 'candy-look/v1',
        interface: 'candy',
        id: 'blush',
        name: 'Blush',
        sub: 'Pink on white, mixed cards',
        palette: 'blush',
        cards: 'mix',
        gradient: 'rich',
        roundness: '28',
        glow: 6,
        motion: 'on',
      },
      {
        schema: 'candy-look/v1',
        interface: 'candy',
        id: 'lilac',
        name: 'Lilac',
        sub: 'Violet into blue, airy',
        palette: 'lilac',
        cards: 'mix',
        gradient: 'vivid',
        roundness: '32',
        glow: 5,
        motion: 'on',
      },
      {
        schema: 'candy-look/v1',
        interface: 'candy',
        id: 'nightbloom',
        name: 'Night bloom',
        sub: 'Neon pinks after dark',
        palette: 'nightbloom',
        cards: 'mix',
        gradient: 'vivid',
        roundness: '28',
        glow: 8,
        motion: 'on',
      },
    ]);
    for (const look of CANDY_PRESET_LOOKS) {
      expect(Object.keys(look)).toEqual(PRESET_FIELDS);
    }
  });

  it('matches its palette in the catalogue: id, name and line, in its order', () => {
    expect(CANDY_PRESET_LOOKS).toHaveLength(PALETTES.length);
    PALETTES.forEach((palette, i) => {
      expect(CANDY_PRESET_LOOKS[i]).toMatchObject({
        id: palette.id,
        name: palette.name,
        sub: palette.sub,
        palette: palette.id,
      });
    });
  });

  it('every preset passes the vendored validateLook against the Candy schema with no errors', () => {
    for (const look of CANDY_PRESET_LOOKS) {
      expect(validateLook(CANDY_LOOK_SPEC, look)).toEqual([]);
      expect(isCandyLook(look)).toBe(true);
      expect(Object.isFrozen(look)).toBe(true);
    }
  });
});

describe("spec.ts's words", () => {
  it('names each choice as the look editor does, a palette by its catalogue name', () => {
    expect(CANDY_CHOICE_WORDS).toEqual({
      palette: { blush: 'Blush', lilac: 'Lilac', nightbloom: 'Night bloom' },
      cards: { mix: 'Mixed', single: 'One colour' },
      gradient: { soft: 'Soft', rich: 'Rich', vivid: 'Vivid' },
      motion: { on: 'On', paused: 'Paused' },
    });
  });

  it('words every choice the schema offers', () => {
    for (const knob of ['palette', 'cards', 'gradient', 'motion'] as const) {
      expect(Object.keys(CANDY_CHOICE_WORDS[knob])).toEqual(candyChoiceSpec(knob).choices);
    }
  });

  it("says the design's note under each Gradient choice", () => {
    expect(CANDY_GRADIENT_NOTES).toEqual({
      soft: 'One hue per card',
      rich: 'Hues blend card to card',
      vivid: 'Blends, glows and aura',
    });
  });
});

describe('what the vendored validateLook refuses', () => {
  const blush: CandyLook = CANDY_DEFAULT_LOOK;
  const codes = (look: unknown) => candyLookErrors(look).map((error) => error.code);

  it('refuses values outside a knob: roundness 41, a fraction of glow, an unknown palette', () => {
    expect(codes({ ...blush, roundness: '41' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, roundness: '15' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, roundness: 28 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, glow: 6.5 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, glow: 11 })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, glow: '6' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, palette: 'mint' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, cards: 'all' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, gradient: 'flat' })).toEqual(['LOOK_BAD_VALUE']);
    expect(codes({ ...blush, motion: 'off' })).toEqual(['LOOK_BAD_VALUE']);
  });

  it("refuses Arcade's and HUD's documents, a bad id or name, and a look's unknown fields", () => {
    expect(codes({ ...blush, schema: 'arcade-look/v1' })).toEqual(['LOOK_WRONG_SCHEMA']);
    expect(codes({ ...blush, interface: 'arcade' })).toEqual(['LOOK_WRONG_SCHEMA']);
    expect(codes({ ...blush, id: '../blush' })).toEqual(['LOOK_BAD_ID']);
    expect(codes({ ...blush, name: '   ' })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...blush, sub: 'x'.repeat(41) })).toEqual(['LOOK_BAD_TEXT']);
    expect(codes({ ...blush, colour: 'pink' })).toEqual(['LOOK_UNKNOWN_FIELD']);
    expect(codes(null)).toEqual(['LOOK_NOT_AN_OBJECT']);
  });

  it('takes an empty line under the name, and every Roundness key and whole Glow', () => {
    expect(isCandyLook({ ...blush, sub: '' })).toBe(true);
    for (const roundness of KIT_ROUNDNESS) expect(isCandyLook({ ...blush, roundness })).toBe(true);
    for (const glow of [0, 10]) expect(isCandyLook({ ...blush, glow })).toBe(true);
  });
});
