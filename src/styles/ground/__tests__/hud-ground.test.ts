import { describe, expect, it } from 'vitest';

import { rgba } from '../../../core/web/lib/look-kit/css';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../hud/look-schema';
import { HUD_GRID, HUD_SCANLINES, hudVars } from '../../tokens/hud';
import { gridBars, hudGroundPlan, scanlineBars } from '../hud-ground';
import { HUD_SPOT } from '../spots';

const PHONE = { width: 390, height: 844 };

function planFor(look: HudLook) {
  return hudGroundPlan(look, hudVars(look));
}

describe('hudGroundPlan', () => {
  it("paints the look's glow, grid and the README's scanline", () => {
    for (const look of HUD_PRESET_LOOKS) {
      const vars = hudVars(look);
      const plan = planFor(look);
      expect(plan.spot, look.id).toBe(HUD_SPOT);
      expect(plan.colours, look.id).toEqual({
        glow: { centre: vars.glow, edge: rgba(vars.accent, 0) },
        grid: vars.grid,
        scanline: vars.scanline,
      });
    }
  });

  it("draws the scanlines only while the look's scan is on", () => {
    expect(planFor({ ...HUD_DEFAULT_LOOK, scan: 'on' }).scan).toBe(true);
    expect(planFor({ ...HUD_DEFAULT_LOOK, scan: 'off' }).scan).toBe(false);
  });

  it('draws no grid at grid 0', () => {
    expect(planFor({ ...HUD_DEFAULT_LOOK, grid: 0 }).grid).toBe(false);
    expect(planFor({ ...HUD_DEFAULT_LOOK, grid: 1 }).grid).toBe(true);
  });

  it('is static: the look’s motion changes nothing drawn', () => {
    expect(planFor({ ...HUD_DEFAULT_LOOK, motion: 'off' })).toEqual(
      planFor({ ...HUD_DEFAULT_LOOK, motion: 'on' }),
    );
  });
});

describe('gridBars', () => {
  it('lays 1 pt lines every 32 pt from the top-left, across the whole screen', () => {
    expect(HUD_GRID).toEqual({ square: 32, line: 1 });
    const bars = gridBars(PHONE);
    const verticals = bars.filter((bar) => bar.height === PHONE.height);
    const horizontals = bars.filter((bar) => bar.width === PHONE.width);
    expect(verticals.map((bar) => bar.x)).toEqual(Array.from({ length: 13 }, (_, i) => i * 32));
    expect(horizontals.map((bar) => bar.y)).toEqual(Array.from({ length: 27 }, (_, i) => i * 32));
    expect(bars.every((bar) => bar.width === 1 || bar.height === 1)).toBe(true);
  });

  it('draws nothing on a screen not yet measured', () => {
    expect(gridBars({ width: 0, height: 0 })).toEqual([]);
  });
});

describe('scanlineBars', () => {
  it('lays a 1 pt line every 3 pt, counted from the bottom', () => {
    expect(HUD_SCANLINES).toEqual({ line: 1, period: 3 });
    const bars = scanlineBars(PHONE);
    expect(bars).toHaveLength(Math.ceil(PHONE.height / 3));
    expect(bars[0]).toEqual({ x: 0, y: PHONE.height - 1, width: PHONE.width, height: 1 });
    expect(bars[1].y).toBe(PHONE.height - 4);
    expect(bars.at(-1)?.y).toBe(0);
  });
});
