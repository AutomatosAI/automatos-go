// The edge screens' derived colours (US-017f): the snag card's error line at 40 %, Lost's '404' as
// the ground mixed 10 % toward the text (Ember's #2A2420 on Graphite), and Not running's command
// box — the ground shaded toward black (Ember's #080706) where it shades, the surface elsewhere,
// under the text at 16 %.

import { describe, expect, it } from 'vitest';

import { EMBER } from '../../../core/frozen/lib/looks/presets';
import { EDGE_ALPHAS, edgeColours, type EdgeColourSource } from '../edge-colours';
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
