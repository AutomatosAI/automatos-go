// Candy's voice core (US-023l, CANDY-LAYOUT §7), pure: its orb 240 in the drawn 290 core and
// Candy's Auto in it at half the orb, both centred on whole points, in step as a short screen
// shrinks the core (coreSizeIn's least, 120), and the drawn size when the side is not usable.

import { describe, expect, it } from 'vitest';

import { CANDY_CORE, candyCorePlace } from '../candy-core';
import { HUD_CORE } from '../model';
import { CORE_SIZE } from '../ring-specs';

describe('candyCorePlace', () => {
  it('puts the orb at 240 and Auto at 120 in the 290 core, centred', () => {
    expect(CANDY_CORE).toEqual({ orb: 240, autoShare: 0.5 });
    expect(candyCorePlace(CORE_SIZE.phone)).toEqual({
      orb: { side: 240, offset: 25 },
      auto: { side: 120, offset: 85 },
    });
  });

  it('shrinks in step with the core, never past the core or off its centre', () => {
    for (const size of [HUD_CORE.core.minSize, 200, 251, CORE_SIZE.phone]) {
      const { orb, auto } = candyCorePlace(size);
      expect(orb.side).toBe(Math.round((240 * size) / CORE_SIZE.phone));
      expect(auto.side).toBe(Math.round(orb.side / 2));
      expect(orb.side).toBeLessThan(size);
      for (const piece of [orb, auto]) {
        expect(Number.isInteger(piece.offset)).toBe(true);
        expect(Math.abs(piece.offset * 2 + piece.side - size)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('takes the drawn core for a side it cannot use, and is frozen', () => {
    expect(candyCorePlace(Number.NaN)).toEqual(candyCorePlace(CORE_SIZE.phone));
    expect(candyCorePlace(0)).toEqual(candyCorePlace(CORE_SIZE.phone));
    expect(Object.isFrozen(candyCorePlace(200))).toBe(true);
    expect(Object.isFrozen(candyCorePlace(200).orb)).toBe(true);
  });
});
