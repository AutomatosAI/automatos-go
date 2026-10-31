// The ring's paints (mascot-colours.ts): Mascot.dc.html's rgba(ring, .35) glow over its 2 pt
// stroke in the ring colour, and a fill that fades to the ring colour at 0.

import { describe, expect, it } from 'vitest';

import { SPRITE_COLOURS } from '../arcade-catalogue';
import { AUTO_COLOURS } from '../candy-catalogue';
import {
  RING_GLOW_ALPHA,
  arcadeSpriteColours,
  candyAutoColour,
  ringColours,
} from '../mascot-colours';

describe('ringColours', () => {
  it('glows at 0.35 of the ring colour', () => {
    expect(RING_GLOW_ALPHA).toBe(0.35);
    expect(ringColours('#4BF0B7')).toEqual({
      stroke: '#4BF0B7',
      glow: 'rgba(75,240,183,0.35)',
      edge: 'rgba(75,240,183,0)',
    });
  });

  it('works for every ring colour the drawing names, frozen', () => {
    const paints = ringColours('#5E578F');
    expect(paints.glow).toBe('rgba(94,87,143,0.35)');
    expect(Object.isFrozen(paints)).toBe(true);
  });
});

describe('arcadeSpriteColours', () => {
  it("draws the bronze robot on the dark palettes and Handheld's four shades on Handheld", () => {
    for (const palette of ['overworld', 'dungeon', 'neon', 'nightcity'] as const) {
      expect(arcadeSpriteColours({ palette }), palette).toBe(SPRITE_COLOURS.bronze);
    }
    expect(arcadeSpriteColours({ palette: 'handheld' })).toBe(SPRITE_COLOURS.shades);
    expect(arcadeSpriteColours({ palette: 'overworld' }).s).toBe('#D86A2B');
  });
});

describe('candyAutoColour', () => {
  it("is Auto's colour itself when opaque, and at a stop's alpha otherwise", () => {
    expect(candyAutoColour('bodyA')).toBe(AUTO_COLOURS.bodyA);
    expect(candyAutoColour('visorB', 1)).toBe('#24102F');
    expect(candyAutoColour('gloss', 0.6)).toBe('rgba(255,255,255,0.6)');
    expect(candyAutoColour('eyeGlow', 0)).toBe('rgba(255,179,224,0)');
  });

  it('clamps an alpha outside 0-1', () => {
    expect(candyAutoColour('cyan', 1.4)).toBe(AUTO_COLOURS.cyan);
    expect(candyAutoColour('cyan', -0.2)).toBe('rgba(120,205,255,0)');
  });
});
