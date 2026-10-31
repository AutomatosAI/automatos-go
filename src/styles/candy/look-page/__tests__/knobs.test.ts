// Make it sweet's knob rows, their pure rules (US-023m; the kit's spec.ts KNOBS and GRADIENT_NOTES
// and looks/look-controls.tsx at 3920359d5 as references): the schema's labels, each choice's word
// with the look's one chosen, the palette swatches from the catalogue, the Gradient row's note, the
// sliders' whole steps (Roundness 16–40 written as its key, Glow 0–10 clamped), their values shown
// and spoken, and the Motion row under Reduce Motion. Never a mutation.

import { describe, expect, it } from 'vitest';

import { CARD_SETS, PALETTES } from '../../../tokens/candy-catalogue';
import { CANDY_ROUNDNESS } from '../../../tokens/candy';
import { INITIAL_CANDY_LOOKS, setKnob, setNumber, sliderKey } from '../../candy-looks';
import {
  CANDY_DEFAULT_LOOK,
  CANDY_GRADIENT_NOTES,
  CANDY_LOOK_SCHEMA,
  CANDY_PRESET_LOOKS,
  type CandyLook,
} from '../../look-schema';
import { CANDY_SWEET_COPY } from '../../strings';
import {
  glowRow,
  motionRow,
  motionValue,
  paletteRow,
  roundnessRow,
  segmentRow,
  swatchOf,
} from '../knobs';

const look = (values: Partial<CandyLook>): CandyLook => ({ ...CANDY_DEFAULT_LOOK, ...values });
const chosen = (choices: readonly { selected: boolean; value: string }[]) =>
  choices.filter((choice) => choice.selected).map((choice) => choice.value);

describe('the rows', () => {
  it("are titled with looks/schema.json's labels", () => {
    const { knobs } = CANDY_LOOK_SCHEMA;
    expect(paletteRow(CANDY_DEFAULT_LOOK).title).toBe(knobs.palette.label);
    expect(segmentRow(CANDY_DEFAULT_LOOK, 'cards').title).toBe('Card colours');
    expect(segmentRow(CANDY_DEFAULT_LOOK, 'gradient').title).toBe('Gradient');
    expect(roundnessRow(CANDY_DEFAULT_LOOK).title).toBe('Roundness');
    expect(glowRow(CANDY_DEFAULT_LOOK).title).toBe('Glow');
    expect(motionRow(CANDY_DEFAULT_LOOK, false).title).toBe('Motion');
  });

  it('are frozen, and never change the look they read', () => {
    const before = JSON.stringify(CANDY_DEFAULT_LOOK);
    const rows = [paletteRow(CANDY_DEFAULT_LOOK), segmentRow(CANDY_DEFAULT_LOOK, 'gradient')];
    expect(rows.every((row) => Object.isFrozen(row) && Object.isFrozen(row.choices))).toBe(true);
    expect(Object.isFrozen(motionRow(CANDY_DEFAULT_LOOK, true))).toBe(true);
    expect(JSON.stringify(CANDY_DEFAULT_LOOK)).toBe(before);
  });
});

describe('Palette', () => {
  it("offers the three palettes in the schema's order, named by the catalogue, the look's chosen", () => {
    const row = paletteRow(look({ palette: 'lilac' }));
    expect(row.choices.map((choice) => choice.value)).toEqual(['blush', 'lilac', 'nightbloom']);
    expect(row.choices.map((choice) => choice.word)).toEqual(['Blush', 'Lilac', 'Night bloom']);
    expect(row.choices.map((choice) => choice.label)).toEqual(['Blush', 'Lilac', 'Night bloom']);
    expect(chosen(row.choices)).toEqual(['lilac']);
  });

  it("paints each swatch with its palette's first two card colours' starts", () => {
    for (const palette of PALETTES) {
      const [first, second] = palette.order;
      expect(swatchOf(palette.id)).toEqual({ a: CARD_SETS[first].a, b: CARD_SETS[second].a });
    }
    const row = paletteRow(CANDY_DEFAULT_LOOK);
    expect(row.choices.map((choice) => choice.swatch)).toEqual(
      PALETTES.map((palette) => swatchOf(palette.id)),
    );
    expect(swatchOf('unknown')).toBeNull();
  });
});

describe('Card colours and Gradient', () => {
  it("say spec.ts KNOBS' words, the look's choice chosen", () => {
    const cards = segmentRow(look({ cards: 'single' }), 'cards');
    expect(cards.choices.map((choice) => choice.word)).toEqual(['Mixed', 'One colour']);
    expect(chosen(cards.choices)).toEqual(['single']);
    expect(cards.note).toBeNull();
    const gradient = segmentRow(look({ gradient: 'vivid' }), 'gradient');
    expect(gradient.choices.map((choice) => choice.word)).toEqual(['Soft', 'Rich', 'Vivid']);
    expect(chosen(gradient.choices)).toEqual(['vivid']);
  });

  it("put the look's GRADIENT_NOTES under the Gradient row", () => {
    expect(segmentRow(look({ gradient: 'soft' }), 'gradient').note).toBe('One hue per card');
    expect(segmentRow(look({ gradient: 'rich' }), 'gradient').note).toBe(CANDY_GRADIENT_NOTES.rich);
    expect(segmentRow(look({ gradient: 'vivid' }), 'gradient').note).toBe('Blends, glows and aura');
  });
});

describe('the sliders', () => {
  it('run Roundness over whole points 16 to 40, from the look’s key', () => {
    const row = roundnessRow(look({ roundness: '32' }));
    expect([row.min, row.max, row.value]).toEqual([CANDY_ROUNDNESS.min, CANDY_ROUNDNESS.max, 32]);
    expect(row.shown).toBe('32 pt');
    expect(row.spoken(32)).toBe('32 points');
  });

  it("write Roundness's position as its choice key, clamped and whole", () => {
    const at = (n: number) =>
      setKnob(INITIAL_CANDY_LOOKS, 'roundness', sliderKey(n)).active.roundness;
    expect(at(33)).toBe('33');
    expect(at(12)).toBe('16');
    expect(at(44)).toBe('40');
    expect(at(27.6)).toBe('28');
  });

  it('run Glow over whole numbers 0 to 10, said out of 10', () => {
    const row = glowRow(look({ glow: 6 }));
    expect([row.min, row.max, row.value]).toEqual([0, 10, 6]);
    expect(row.shown).toBe('6');
    expect(row.spoken(3)).toBe('3 of 10');
  });

  it('write Glow through setNumber, clamped and rounded', () => {
    const at = (n: number) => setNumber(INITIAL_CANDY_LOOKS, 'glow', n).active.glow;
    expect([at(-2), at(4.4), at(12)]).toEqual([0, 4, 10]);
  });

  it("show each preset's own values", () => {
    for (const preset of CANDY_PRESET_LOOKS) {
      expect(roundnessRow(preset).value).toBe(Number(preset.roundness));
      expect(glowRow(preset).value).toBe(preset.glow);
    }
  });
});

describe('Motion', () => {
  const said = CANDY_SWEET_COPY.motion;

  it("is the look's own switch: on while it moves, off while it is paused", () => {
    expect(motionRow(look({ motion: 'on' }), false)).toEqual({
      title: 'Motion',
      on: true,
      disabled: false,
      words: said.on,
    });
    expect(motionRow(look({ motion: 'paused' }), false)).toMatchObject({
      on: false,
      disabled: false,
      words: 'Paused · everything still',
    });
  });

  it("says 'Motion off · Reduce Motion' and cannot be changed under Reduce Motion", () => {
    for (const motion of ['on', 'paused'] as const) {
      expect(motionRow(look({ motion }), true)).toMatchObject({
        on: false,
        disabled: true,
        words: 'Motion off · Reduce Motion',
      });
    }
  });

  it('writes on or paused when flipped', () => {
    expect(motionValue(true)).toBe('on');
    expect(motionValue(false)).toBe('paused');
    expect(setKnob(INITIAL_CANDY_LOOKS, 'motion', motionValue(false)).active.motion).toBe('paused');
  });
});
