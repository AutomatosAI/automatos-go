import { describe, expect, it } from 'vitest';

import { rgba } from '../../../core/web/lib/look-kit/css';
import { safeGlowAlpha, snagGlowAlpha } from '../../../core/frozen/lib/looks/engine';
import { AURORA, DAYLIGHT, EMBER, PRESETS } from '../../../core/frozen/lib/looks/presets';
import { HUD_PRESET_LOOKS } from '../../hud/look-schema';
import { ARCADE_DEFAULT_PICKS, arcadeVars } from '../arcade';
import { PALETTE_IDS } from '../arcade-catalogue';
import {
  EMBER_GLOW_ALPHA,
  arcadeGroundColours,
  hudGroundColours,
  playGlowAlpha,
  playLightStops,
  playSnagStops,
} from '../ground-colours';
import { hudVars } from '../hud';
import { playVars } from '../play';

describe('playGlowAlpha', () => {
  it('is drawn for Ember, at its glow of 24', () => {
    expect(EMBER_GLOW_ALPHA).toBe(0.24);
    expect(playGlowAlpha(EMBER, 0.2)).toBe(0.2);
    expect(playGlowAlpha(EMBER, 0.16)).toBe(0.16);
  });

  it("scales with the look's glow", () => {
    expect(playGlowAlpha(AURORA, 0.24)).toBe(0.2);
    expect(playGlowAlpha(AURORA, 0.12)).toBe(0.1);
  });

  it('never passes the safe glow for the ground and accent', () => {
    for (const look of [...PRESETS, ...PRESETS.map((preset) => ({ ...preset, glow: 40 }))]) {
      const cap = safeGlowAlpha(look.ground, look.accent);
      for (const drawn of [0.16, 0.2, 0.24, 0.26]) {
        expect(playGlowAlpha(look, drawn), look.id).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('playLightStops', () => {
  it('builds each light from the look’s own variables, fading to the same colour at 0', () => {
    const vars = playVars(EMBER);
    expect(playLightStops(EMBER, vars, 'glow', 0.24)).toEqual({
      centre: rgba(vars.accent, 0.24),
      edge: rgba(vars.accent, 0),
    });
    expect(playLightStops(EMBER, vars, 'dusk', 0.18)).toEqual({
      centre: rgba(vars.autoDusk, 0.18),
      edge: rgba(vars.autoDusk, 0),
    });
    expect(playLightStops(EMBER, vars, 'error', 0.16).centre).toBe(
      rgba(vars.error, snagGlowAlpha(EMBER.ground)),
    );
  });

  it("keeps the error light under the ground's snag alpha on Paper", () => {
    const vars = playVars(DAYLIGHT);
    expect(playLightStops(DAYLIGHT, vars, 'error', 0.16).centre).toBe(rgba(vars.error, 0.1));
  });
});

describe('playSnagStops', () => {
  it('is --pl-glow-snag at the centre for every preset', () => {
    for (const look of PRESETS) {
      const vars = playVars(look);
      expect(playSnagStops(look, vars), look.id).toEqual({
        centre: vars.glowSnag,
        edge: rgba(vars.error, 0),
      });
    }
  });
});

describe('hudGroundColours', () => {
  it("is the look's glow, grid and scanline", () => {
    for (const look of HUD_PRESET_LOOKS) {
      const vars = hudVars(look);
      expect(hudGroundColours(vars), look.id).toEqual({
        glow: { centre: vars.glow, edge: rgba(vars.accent, 0) },
        grid: vars.grid,
        scanline: vars.scanline,
      });
    }
  });
});

describe('arcadeGroundColours', () => {
  it("is the palette's page and its scanlines' colour, for every palette", () => {
    for (const palette of PALETTE_IDS) {
      const vars = arcadeVars({ ...ARCADE_DEFAULT_PICKS, palette });
      expect(arcadeGroundColours(vars), palette).toEqual({ page: vars.page, scanline: vars.scan });
    }
    expect(arcadeGroundColours(arcadeVars(ARCADE_DEFAULT_PICKS))).toEqual({
      page: '#0D1710',
      scanline: 'rgba(0,0,0,0.14)',
    });
  });
});
