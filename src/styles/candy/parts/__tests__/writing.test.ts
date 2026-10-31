// "Auto is writing" (writing.ts; P2, the kit's thread.module.css candy-writing at 3920359d5): the
// three dots in the cards' starts, each bouncing 4 pt over 1.2 s (up by 30 %, back by 60 %, at
// rest to the end), the second 0.15 s and the third 0.3 s behind; and WritingChip.tsx bounces them
// only while Candy moves, its words always there.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CARD_START_VARS } from '../../../tokens/candy';
import { CANDY_COPY } from '../../strings';
import { WRITING, WRITING_DOTS, dotLiftAt } from '../writing';

const CHIP_SOURCE = readFileSync(path.resolve(__dirname, '../WritingChip.tsx'), 'utf8');

describe('the writing chip', () => {
  it('is a 36 pt chip of three 7 pt dots in the three cards’ starts, and the words', () => {
    expect(WRITING.height).toBe(36);
    expect(WRITING.dot).toBe(7);
    expect(WRITING_DOTS).toEqual(['g1a', 'g2a', 'g3a']);
    expect(CARD_START_VARS).toEqual({ 1: 'g1a', 2: 'g2a', 3: 'g3a' });
    expect(CANDY_COPY.writing).toBe('Auto is writing');
  });
});

describe('dotLiftAt', () => {
  it('lifts the first dot 4 pt at 30 % of the cycle and sets it down by 60 %', () => {
    expect(dotLiftAt(0, 0)).toBe(0);
    expect(dotLiftAt(360, 0)).toBeCloseTo(-4);
    expect(dotLiftAt(720, 0)).toBe(0);
    expect(dotLiftAt(1000, 0)).toBe(0);
    expect(dotLiftAt(1200 + 360, 0)).toBeCloseTo(-4);
  });

  it('eases each step: halfway up at 15 %, halfway down at 45 %', () => {
    expect(dotLiftAt(180, 0)).toBeCloseTo(-2);
    expect(dotLiftAt(540, 0)).toBeCloseTo(-2);
    expect(dotLiftAt(90, 0)).toBeGreaterThan(-1);
  });

  it('runs the second dot 0.15 s and the third 0.3 s behind the first', () => {
    expect(dotLiftAt(360 + 150, 1)).toBeCloseTo(-4);
    expect(dotLiftAt(360 + 300, 2)).toBeCloseTo(-4);
    expect(dotLiftAt(100, 2)).toBe(0);
  });

  it('never lifts below the rest or past 4 pt, and reads a time that is not a number as at rest', () => {
    for (let ms = 0; ms < 2400; ms += 33) {
      for (const index of [0, 1, 2]) {
        const lift = dotLiftAt(ms, index);
        expect(lift).toBeLessThanOrEqual(0);
        expect(lift).toBeGreaterThanOrEqual(-WRITING.lift);
      }
    }
    expect(dotLiftAt(Number.NaN, 0)).toBe(0);
  });
});

describe('WritingChip.tsx', () => {
  it('bounces only while Candy moves, on the one clock', () => {
    expect(CHIP_SOURCE).toMatch(/useCandyMotion\(\)/);
    expect(CHIP_SOURCE).toMatch(/useCandyTick\(moving\)/);
    expect(CHIP_SOURCE).toMatch(/translateY: moving \? dotLiftAt\(ms, index\) : 0/);
  });

  it('always shows the words, and VoiceOver hears them alone', () => {
    expect(CHIP_SOURCE).toMatch(/\{CANDY_COPY\.writing\}<\/Text>/);
    expect(CHIP_SOURCE).toMatch(/accessibilityLabel=\{CANDY_COPY\.writing\}/);
  });
});
