// The look pages' derived colours (drawer-colours.ts): HUD's swatch edge and ring glow, and
// Arcade's Options choices as the kit's looks.module.css paints them (the page in a ring of the
// window border, the chosen one in the highlight with its ink, focus in the accent).

import { describe, expect, it } from 'vitest';

import { ARCADE_DEFAULT_PICKS, arcadeVars } from '../arcade';
import { PALETTE_IDS } from '../arcade-catalogue';
import { HUD_SWATCH_EDGE, arcadeChoiceColours, ringGlow } from '../drawer-colours';

describe("HUD's drawer colours", () => {
  it('edges a swatch in white at 25 % and glows a ring inside and out', () => {
    expect(HUD_SWATCH_EDGE).toBe('rgba(255,255,255,0.25)');
    expect(ringGlow('#3FE0FF', 12, 8)).toBe('0 0 12px #3FE0FF, inset 0 0 8px #3FE0FF');
  });
});

describe("Arcade's Options choices", () => {
  it("paints Overworld's choices as the kit does", () => {
    const colours = arcadeChoiceColours(arcadeVars(ARCADE_DEFAULT_PICKS));
    expect(colours).toEqual({
      face: '#0D1710',
      ring: '#D9CFA8',
      text: '#EEE7D2',
      chosenFace: '#7FE35C',
      chosenText: '#0B1A07',
      focus: '#7FE35C',
    });
    expect(Object.isFrozen(colours)).toBe(true);
  });

  it("takes every palette's own variables", () => {
    for (const palette of PALETTE_IDS) {
      const vars = arcadeVars({ ...ARCADE_DEFAULT_PICKS, palette });
      expect(arcadeChoiceColours(vars), palette).toMatchObject({
        face: vars.page,
        chosenFace: vars.hl,
        chosenText: vars.hlt,
      });
    }
  });
});
