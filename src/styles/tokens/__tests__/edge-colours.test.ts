// The edge screens' derived colours (US-017f): the snag card's error line at 40 %, Lost's '404' as
// the ground mixed 10 % toward the text (Ember's #2A2420 on Graphite), and Not running's command
// box — the ground shaded toward black (Ember's #080706) where it shades, the surface elsewhere,
// under the text at 16 %.

import { describe, expect, it } from 'vitest';

import { EMBER } from '../../../core/frozen/lib/looks/presets';
import { ARCADE_DEFAULT_PICKS, arcadeVars } from '../arcade';
import { CANDY_DEFAULT_PICKS, candyTokens, candyVars } from '../candy';
import {
  EDGE_ALPHAS,
  arcadeEdgeSource,
  candyEdgeSource,
  edgeColours,
  type EdgeColourSource,
} from '../edge-colours';
import { playVars } from '../play';

function emberSource(shade: boolean): EdgeColourSource {
  const vars = playVars(EMBER);
  return {
    ground: vars.groundBg,
    text: vars.groundText,
    surface: vars.groundSurface,
    error: vars.error,
    shade,
  };
}

describe('the edge colours', () => {
  it("paints Ember's Graphite as Ember draws 07-09", () => {
    const vars = playVars(EMBER);
    expect([vars.groundBg, vars.groundText, vars.groundSurface]).toEqual([
      '#131110',
      '#F4EEE8',
      '#1D1917',
    ]);
    const colours = edgeColours(emberSource(true));
    // Ember draws #2A2420 and #080706: as dark, a shade less warm
    expect(colours.lostNumber).toBe('#2A2726');
    expect(colours.commandFill).toBe('#080707');
    expect(colours.commandLine).toBe('rgba(244,238,232,0.16)');
    expect(colours.snagLine).toMatch(/^rgba\(\d+,\d+,\d+,0\.4\)$/);
  });

  it('takes the surface for the command box where the ground is not shaded', () => {
    expect(edgeColours(emberSource(false)).commandFill).toBe('#1D1917');
  });

  it("keeps Ember's alphas", () => {
    expect(EDGE_ALPHAS).toEqual({
      snagLine: 0.4,
      lostNumber: 0.1,
      commandLine: 0.16,
      commandShade: 0.58,
    });
  });
});

describe("Arcade's edge ground", () => {
  it('is the window, its text, the page sunk in as the command box and HP red', () => {
    const source = arcadeEdgeSource(arcadeVars(ARCADE_DEFAULT_PICKS));
    expect(source).toEqual({
      ground: '#15291B',
      text: '#EEE7D2',
      surface: '#0D1710',
      error: '#FF6E61',
      shade: false,
    });
    const colours = edgeColours(source);
    expect(colours.commandFill).toBe('#0D1710');
    expect(colours.snagLine).toBe('rgba(255,110,97,0.4)');
    expect(colours.commandLine).toBe('rgba(238,231,210,0.16)');
  });
});

describe("Candy's edge ground", () => {
  it("is the window, its text, the chip as the command box and Candy's red", () => {
    const source = candyEdgeSource(candyVars(CANDY_DEFAULT_PICKS), candyTokens(CANDY_DEFAULT_PICKS));
    expect(source).toEqual({
      ground: '#FFFFFF',
      text: '#2A1830',
      surface: '#FCE8F1',
      error: '#C02436',
      shade: false,
    });
    const colours = edgeColours(source);
    expect(colours.commandFill).toBe('#FCE8F1');
    expect(colours.snagLine).toBe('rgba(192,36,54,0.4)');
    expect(colours.commandLine).toBe('rgba(42,24,48,0.16)');
  });

  it("takes Night bloom's dark window and its lighter red", () => {
    const night = { ...CANDY_DEFAULT_PICKS, palette: 'nightbloom' as const };
    expect(candyEdgeSource(candyVars(night), candyTokens(night))).toMatchObject({
      ground: '#22142F',
      error: '#FF7A88',
    });
  });
});
