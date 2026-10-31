// The gradient card and the band (GradientCard.tsx, Band.tsx, CardFill.tsx; CANDY-LAYOUT §3):
// each draws the paint model tokens/candy-paint.ts computes, with Skia, to the size it lays out at
// — the card its set's cardGradient clipped to its corners (rs unless told otherwise) under
// candyShadow, the band bandGradient through bandPath over the page and Vivid's aura — and takes
// every colour from the palette's variables or the model, never one of its own (D-TOKENS).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CANDY_DEFAULT_PICKS, candyShadow, candyVars, innerRadius } from '../../../tokens/candy';
import { cardGradient } from '../../../tokens/candy-paint';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const CARD = read('GradientCard.tsx');
const FILL = read('CardFill.tsx');
const BAND = read('Band.tsx');
const PARTS = [
  'Avatar.tsx',
  'Band.tsx',
  'CardFill.tsx',
  'GradientCard.tsx',
  'Orb.tsx',
  'Pill.tsx',
  'StatusChip.tsx',
  'TabBar.tsx',
  'WritingChip.tsx',
];

describe('GradientCard.tsx', () => {
  it("fills with its set's cardGradient, sized from its layout, under candyShadow", () => {
    expect(CARD).toMatch(/from '@shopify\/react-native-skia'/);
    expect(CARD).toMatch(/cardGradient\(look, set, size\)/);
    expect(CARD).toMatch(/useLayoutSize\(\)/);
    expect(CARD).toMatch(/shadow \? paint\.shadow : null/);
  });

  it('rounds by rs unless given a radius or a corner each, and clips the paint to them', () => {
    expect(CARD).toMatch(/corners \?\? uniformCorners\(radius \?\? paint\.rs\)/);
    expect(CARD).toMatch(/useSkiaPath\(cornersPath\(size, corners\)\)/);
  });

  it("draws the linear, Vivid's glows, then the highlight (CardFill)", () => {
    expect(FILL.indexOf('<LinearGradient')).toBeLessThan(FILL.indexOf('glows.map'));
    expect(FILL.indexOf('glows.map')).toBeLessThan(FILL.indexOf('paint={highlight}'));
  });

  it("reads the default look's corners and shadow as CANDY-LAYOUT gives them", () => {
    expect(innerRadius(CANDY_DEFAULT_PICKS.roundness)).toBe(20);
    expect(candyShadow(CANDY_DEFAULT_PICKS)).toMatchObject({
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
    });
  });

  it("grounds the box in its set's start colour, the gradient's first stop", () => {
    const vars = candyVars(CANDY_DEFAULT_PICKS);
    const gradient = cardGradient(CANDY_DEFAULT_PICKS, 2, { w: 132, h: 172 });
    expect(gradient.linear.colours[0]).toBe(vars.g2a);
    expect(CARD).toMatch(/paint\.vars\[CARD_START_VARS\[set\]\]/);
  });
});

describe('Band.tsx', () => {
  it('draws the page, then the aura, then the band through its curved outline', () => {
    expect(BAND).toMatch(/bandGradient\(look, band\)/);
    expect(BAND).toMatch(/auraCircles\(look,/);
    expect(BAND).toMatch(/useSkiaPath\(bandPath\(band, curve\)\)/);
    expect(BAND.indexOf('color={vars.page}')).toBeLessThan(BAND.indexOf('aura.map'));
    expect(BAND.indexOf('aura.map')).toBeLessThan(BAND.indexOf('<LinearGradient'));
  });

  it('is decoration: no touches, hidden from VoiceOver', () => {
    expect(BAND).toMatch(/pointerEvents="none"/);
    expect(BAND).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });
});

describe("Candy's parts", () => {
  it('write no colour of their own (D-TOKENS)', () => {
    for (const file of PARTS) {
      expect({ file, literal: /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(read(file)) }).toEqual({
        file,
        literal: false,
      });
    }
  });
});
