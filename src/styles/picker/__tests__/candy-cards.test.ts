// Candy's card in the style picker (US-023m, D-CAN-1): 'Candy', 'Bright, glossy and round' and
// 'Make it sweet →' to its look page; the chosen card ringed in the palette's accent and 'Selected'
// in that accent as text, each at AA on the card's window (win) under every preset and at the knobs'
// ends, never Studio's key; and the small Today its preview draws. Its own file keeps cards.test.ts
// under 400 lines.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { CANDY_PRESET_LOOKS } from '../../candy/look-schema';
import { CANDY_STYLES } from '../../dress/__tests__/fixtures';
import { pickerState } from '../../registry/picker';
import { builtinChoice } from '../../registry/style-id';
import { candyVars } from '../../tokens/candy';
import { PREVIEW, pickerCards, selectedPaint } from '../cards';

/** WCAG AA: the 'Selected' word is normal text; the ring is held to the same. */
const AA = 4.5;

describe("Candy's card", () => {
  it("reads 'Candy', 'Bright, glossy and round' and 'Make it sweet →' to its look page", () => {
    const cards = pickerCards(
      pickerState({
        choice: builtinChoice('candy'),
        studioScheme: 'system',
        installedThemes: [],
        canMobileTheme: false,
      }),
    );
    const candy = cards.find((card) => card.id === 'candy');
    expect(candy).toMatchObject({
      name: 'Candy',
      tagline: 'Bright, glossy and round',
      selected: true,
      selectedWord: 'Selected',
    });
    expect(candy?.lookLink).toMatchObject({
      label: 'Make it sweet →',
      accessibilityLabel: 'Make it sweet',
      href: '/settings/look/candy',
    });
  });
});

describe("Candy's chosen card", () => {
  it("rings it in the palette's accent and words it in that accent as text, under every look", () => {
    expect(CANDY_STYLES.length).toBeGreaterThanOrEqual(CANDY_PRESET_LOOKS.length);
    for (const style of CANDY_STYLES) {
      const { candyLook, candy, tokens } = style;
      if (!candyLook || !candy) throw new Error('a Candy style carries its look and variables');
      const paint = selectedPaint(style);
      expect(paint.ring).toBe(candyVars(candyLook).accent);
      expect(paint.ring).toBe(candy.accent);
      expect(paint.word).toBe(candy.accentText);
      expect(paint.ring).not.toBe(tokens.colours.destructive);
    }
  });

  it('reads at AA on the window, the card’s ground, in every preset and at the knobs’ ends', () => {
    for (const style of CANDY_STYLES) {
      const { candy, candyLook, tokens } = style;
      if (!candy || !candyLook) throw new Error('a Candy style carries its look and variables');
      expect(tokens.colours.card).toBe(candy.win);
      const paint = selectedPaint(style);
      expect(contrastRatio(paint.ring, candy.win), `${candyLook.id} ring`).toBeGreaterThanOrEqual(
        AA,
      );
      expect(contrastRatio(paint.word, candy.win), `${candyLook.id} word`).toBeGreaterThanOrEqual(
        AA,
      );
    }
  });
});

describe("Candy's preview", () => {
  it('is a small Today: the band, Auto at 56, the orb at 96 with a figure, three 40 pt cards', () => {
    expect(PREVIEW.candy).toMatchObject({ auto: 56, orb: 96, figure: '3', card: 40 });
    expect(PREVIEW.candy.band).toBeLessThanOrEqual(PREVIEW.minHeight);
  });

  it('fits its top row and cards in the card’s least height', () => {
    const { pad, gap, orb, card } = PREVIEW.candy;
    expect(pad * 2 + orb + gap + card).toBeLessThanOrEqual(PREVIEW.minHeight);
  });
});
