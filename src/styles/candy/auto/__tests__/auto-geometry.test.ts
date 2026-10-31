// Candy's Auto as the kit draws him (D-CAN-5, KA3-VENDOR-PIN): the vendored auto-geometry.ts,
// auto-path.ts and state-words.ts at 3920359d5 give, for each of the twelve app mascot states,
// the kit's own parts (each shape's box and paint kinds, and every number behind them, pinned by
// fingerprint) and the kit's own SVG paths (kit-auto.ts); every colour is one of Auto's catalogue
// colours; and the pure modules import no React, React Native, Expo or Skia.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MASCOT_STATES } from '../../../../core/frozen/lib/mascot/types';
import { AUTO_COLOURS } from '../../../tokens/candy-catalogue';
import {
  AUTO_BOX,
  BODY,
  EYE_FORMS,
  EYE_PARTS,
  EYE_STROKE,
  VISOR,
  autoParts,
  type Part,
  type Shape,
  type Stop,
} from '../auto-geometry';
import { archBoxes, roundRectPath, shapePath } from '../auto-path';
import { stateGlyph, stateWord } from '../state-words';
import {
  KIT_ABOVE_EYES,
  KIT_BELOW_EYES,
  KIT_PATHS,
  KIT_STATES,
  fingerprint,
  type KitPart,
} from './kit-auto';

const round = (value: number) => Math.round(value * 1000) / 1000;

function summary(part: Part): KitPart {
  const { kind, x, y, w, h } = part.shape;
  return [
    part.name,
    kind,
    [round(x), round(y), round(w), round(h)],
    part.paints.map((paint) => paint.kind),
  ];
}

function shapeOf(state: (typeof MASCOT_STATES)[number], name: string): Shape {
  const part = autoParts(state).find((candidate) => candidate.name === name);
  if (!part) throw new Error(`${state} has no ${name}`);
  return part.shape;
}

describe("the drawing's box", () => {
  it("is the kit's: 104 units from (-2, -4), the body and the visor inside it", () => {
    expect(AUTO_BOX).toEqual({ x: -2, y: -4, size: 104 });
    expect(BODY).toEqual({ x: 6, y: 12, w: 88, h: 85 });
    expect(VISOR.x).toBeCloseTo(19.2, 9);
    expect(VISOR.w).toBeCloseTo(61.6, 9);
    expect(EYE_STROKE).toBe(3.5);
    expect([...EYE_PARTS]).toEqual(['eye-left', 'eye-right']);
  });
});

describe.each(MASCOT_STATES)('Auto %s', (state) => {
  const kit = KIT_STATES[state];
  const parts = autoParts(state);

  it('has an eye form', () => {
    expect(EYE_FORMS[state]).toBeDefined();
  });

  it("has the kit's parts in the kit's order: each box and paint kind", () => {
    const eyes: KitPart[] = [
      ['eye-left', kit.eye, kit.left, ['solid']],
      ['eye-right', kit.eye, kit.right, ['solid']],
    ];
    expect(parts.map(summary)).toEqual([...KIT_BELOW_EYES, ...eyes, ...KIT_ABOVE_EYES]);
  });

  it("matches the kit's every number: gradients, stops and glows", () => {
    expect(fingerprint(JSON.stringify(parts))).toBe(kit.parts);
  });

  it("draws the kit's SVG paths", () => {
    const paths = parts.map((part) => shapePath(part.shape)).join('\n');
    expect(fingerprint(paths)).toBe(kit.paths);
  });

  it("paints only Auto's catalogue colours, at alphas between 0 and 1", () => {
    const colours = parts.flatMap((part): readonly Pick<Stop, 'colour' | 'alpha'>[] => [
      ...part.paints.flatMap((paint): readonly Pick<Stop, 'colour' | 'alpha'>[] =>
        paint.kind === 'solid' ? [paint] : paint.stops,
      ),
      ...(part.glow ? [part.glow] : []),
    ]);
    colours.forEach((paint) => {
      expect(Object.hasOwn(AUTO_COLOURS, paint.colour)).toBe(true);
      expect(paint.alpha).toBeGreaterThanOrEqual(0);
      expect(paint.alpha).toBeLessThanOrEqual(1);
    });
  });

  it('has a glyph and a word for the state pill', () => {
    expect(stateGlyph(state)).toMatch(/^[●○✓✕]$/);
    expect(stateWord(state).length).toBeGreaterThan(0);
  });
});

describe('the paths', () => {
  it("are the kit's, in full, for the body, an open eye and a celebrating eye", () => {
    expect(shapePath(shapeOf('idle', 'body'))).toBe(KIT_PATHS.body);
    expect(shapePath(shapeOf('idle', 'eye-left'))).toBe(KIT_PATHS.idleEye);
    expect(shapePath(shapeOf('celebrate', 'eye-left'))).toBe(KIT_PATHS.celebrateEye);
  });

  it('draws an arch as its outer box less its inner one (filled even-odd)', () => {
    const arch = shapeOf('hello', 'eye-right');
    if (arch.kind !== 'arch') throw new Error('hello has arched eyes');
    const [outer, inner] = archBoxes(arch);
    expect(shapePath(arch)).toBe(`${roundRectPath(outer)} ${roundRectPath(inner)}`);
    expect(inner.x - outer.x).toBeCloseTo(EYE_STROKE, 9);
    expect(inner.h).toBeCloseTo(outer.h - EYE_STROKE, 9);
  });

  it('closes the eyes to lines when asleep', () => {
    expect(EYE_FORMS.sleeping.kind).toBe('line');
    expect(shapeOf('sleeping', 'eye-left').h).toBe(EYE_STROKE);
    expect(autoParts('sleeping').find((part) => part.name === 'eye-left')?.glow).toBeUndefined();
  });
});

describe('the state pill', () => {
  it("says the kit's words: '● Listening', '○ Ready', '✓ Done', '✕ Oops'", () => {
    expect(`${stateGlyph('listening')} ${stateWord('listening')}`).toBe('● Listening');
    expect(`${stateGlyph('idle')} ${stateWord('idle')}`).toBe('○ Ready');
    expect(`${stateGlyph('celebrate')} ${stateWord('celebrate')}`).toBe('✓ Done');
    expect(`${stateGlyph('oops')} ${stateWord('oops')}`).toBe('✕ Oops');
  });
});

describe('the pure modules', () => {
  const PURE = [
    'auto-geometry.ts',
    'auto-path.ts',
    'state-words.ts',
    'clock.ts',
    'stage.ts',
    '../motion-pause.ts',
  ];
  const ENGINE =
    /from ['"](react|react-native|react-native-[^'"]*|@shopify\/react-native-skia|expo|expo-[^'"]*)(\/[^'"]*)?['"]/;

  it.each(PURE)('%s imports no React, React Native, Expo or Skia', (file) => {
    const code = readFileSync(path.join(__dirname, '..', file), 'utf8');
    const imports = code.split('\n').filter((line) => !/^\s*import type /.test(line));
    expect(imports.filter((line) => ENGINE.test(line))).toEqual([]);
  });
});
