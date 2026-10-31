// Candy's pills and status chips (chips.ts; P3 and P4, the README's 'Status'): a pill in the chip
// or window fill and the accent while chosen; a status always a glyph and a word ('● Working' on
// the chip fill, '○ Ready' quiet on nothing), VoiceOver hearing the word; and the parts draw them
// so (Pill.tsx a label when it has nothing to do, StatusChip.tsx the glyph and the word).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CANDY_COPY } from '../../strings';
import { PILL, STATUS_CHIP, pillPaint, statusChipOf } from '../chips';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('pillPaint', () => {
  it('fills a chosen pill with the accent and its ink', () => {
    expect(pillPaint(true)).toEqual({ fill: 'accent', ink: 'accentInk' });
    expect(pillPaint(true, 'win')).toEqual({ fill: 'accent', ink: 'accentInk' });
  });

  it("leaves the rest on the chip fill, or the window's, in text", () => {
    expect(pillPaint(false)).toEqual({ fill: 'chip', ink: 'text' });
    expect(pillPaint(false, 'win')).toEqual({ fill: 'win', ink: 'text' });
  });

  it('is 36 pt tall, as the design draws the type chips', () => {
    expect(PILL.height).toBe(36);
  });
});

describe('statusChipOf', () => {
  it("puts an active status's filled glyph and word on the chip fill, in text", () => {
    expect(statusChipOf(true, 'Working')).toEqual({
      glyph: '●',
      word: 'Working',
      fill: 'chip',
      ink: 'text',
    });
  });

  it("puts a resting status's open glyph and word on nothing, quiet", () => {
    expect(statusChipOf(false, 'Ready')).toEqual({
      glyph: '○',
      word: 'Ready',
      fill: null,
      ink: 'quiet',
    });
  });

  it('never says a status by colour alone: every one has a glyph and a word', () => {
    for (const active of [true, false]) {
      const chip = statusChipOf(active, 'Needs you');
      expect(chip.glyph.length).toBeGreaterThan(0);
      expect(chip.word).toBe('Needs you');
    }
    expect(CANDY_COPY.statusGlyph).toEqual({ active: '●', resting: '○' });
    expect(STATUS_CHIP.height).toBe(26);
  });
});

describe('the parts', () => {
  it('StatusChip draws the glyph and the word, and VoiceOver hears the word', () => {
    const source = read('StatusChip.tsx');
    expect(source).toMatch(/\{`\$\{chip\.glyph\} \$\{chip\.word\}`\}/);
    expect(source).toMatch(/accessibilityLabel=\{chip\.word\}/);
  });

  it('Pill is a plain label without a press, and a button or tab with its selected state with one', () => {
    const source = read('Pill.tsx');
    expect(source).toMatch(/if \(!onPress\) return <View style=\{box\}>\{words\}<\/View>;/);
    expect(source).toMatch(/accessibilityState=\{\{ selected \}\}/);
    expect(source).toMatch(/hitSlop=\{hitSlopFor\(PILL\.height\)\}/);
  });

  it("PillRow slides sideways, padded to the 44 pt touch and the padding taken back", () => {
    const source = read('Pill.tsx');
    expect(source).toMatch(/horizontal/);
    expect(source).toMatch(/touchRoom\(PILL\.height\)/);
  });
});
