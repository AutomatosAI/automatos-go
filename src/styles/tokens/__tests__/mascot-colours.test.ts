// The ring's paints (mascot-colours.ts): Mascot.dc.html's rgba(ring, .35) glow over its 2 pt
// stroke in the ring colour, and a fill that fades to the ring colour at 0.

import { describe, expect, it } from 'vitest';

import { RING_GLOW_ALPHA, ringColours } from '../mascot-colours';

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
