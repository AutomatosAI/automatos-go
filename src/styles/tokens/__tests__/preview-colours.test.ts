// The picker previews' derived colours (US-016h, moved into tokens/ for D-TOKENS in US-016j): Auto's
// ring glow at 35 %, the page glow's clear far stop, and HUD's core rings at 22 %, 40 % and 28 % of
// the accent, the same strings the stand-ins painted before the move.

import { describe, expect, it } from 'vitest';

import { rgba } from '../../../core/web/lib/look-kit/css';
import { EMBER } from '../../../core/frozen/lib/looks/presets';
import { HUD_PRESET_LOOKS } from '../../hud/look-schema';
import { ARCADE_DEFAULT_PICKS, arcadeVars } from '../arcade';
import { hudVars } from '../hud';
import { playVars } from '../play';
import {
  PREVIEW_ALPHAS,
  arcadePreviewColours,
  autoRingGlow,
  coreRingColours,
  glowFade,
} from '../preview-colours';

describe('the preview colours', () => {
  it("keeps the previews' alphas", () => {
    expect(PREVIEW_ALPHAS).toEqual({
      autoRingGlow: 0.35,
      glowFade: 0,
      coreOuter: 0.22,
      coreDashed: 0.4,
      coreDisc: 0.28,
    });
    expect(Object.isFrozen(PREVIEW_ALPHAS)).toBe(true);
  });

  it("glows Auto's ring in its own colour at 35 % and fades the page glow to the clear accent", () => {
    const vars = playVars(EMBER);
    expect(autoRingGlow(vars.autoLight)).toBe(rgba(vars.autoLight, 0.35));
    expect(autoRingGlow(vars.autoLight)).toMatch(/^rgba\(\d+,\d+,\d+,0\.35\)$/);
    expect(glowFade(vars.accent)).toBe(rgba(vars.accent, 0));
    expect(glowFade(vars.accent)).toMatch(/,0\)$/);
  });

  it("paints HUD's core rings in each preset's accent", () => {
    for (const preset of HUD_PRESET_LOOKS) {
      const { accent } = hudVars(preset);
      const rings = coreRingColours(accent);
      expect(rings).toEqual({
        outer: rgba(accent, 0.22),
        dashed: rgba(accent, 0.4),
        disc: rgba(accent, 0.28),
      });
      expect(Object.isFrozen(rings)).toBe(true);
    }
  });
});

describe("Arcade's preview", () => {
  it("paints the small handheld in the palette's own colours", () => {
    const vars = arcadeVars({ ...ARCADE_DEFAULT_PICKS, palette: 'neon' });
    const colours = arcadePreviewColours(vars);
    expect(colours).toEqual({
      screen: vars.page,
      window: vars.win,
      frame: vars.bd,
      shadow: 'rgba(255,82,217,.28)',
      text: vars.tx,
      cursor: vars.ac,
    });
    expect(Object.isFrozen(colours)).toBe(true);
  });
});
