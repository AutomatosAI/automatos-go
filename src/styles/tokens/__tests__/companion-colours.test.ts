// The Companion's derived colours (US-017c): Ember's lines of the ground's text at 8, 16, 14 and
// 7 %, the accent at 40 % and 30 %, the error at 10 % and 45 %, the report card's 135° gradient
// from the accent at 16 % to 3 %, and the paper's rule and bars mixed from the sheet's ink — in
// Ember's own hexes, and once per variables object.

import { describe, expect, it } from 'vitest';

import { DAYLIGHT, EMBER, PRESETS } from '../../../core/web/lib/looks/presets';
import { COMPANION_ALPHAS, companionColours } from '../companion-colours';
import { playVars } from '../play';

const COLOUR = /^(#[0-9A-F]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\))$/i;

describe('the Companion colours', () => {
  it("draws Ember's lines in its cream, molten and coral at Ember's alphas", () => {
    const vars = playVars(EMBER);
    expect([vars.groundText, vars.accent]).toEqual(['#F4EEE8', '#FF6A1F']);
    const colours = companionColours(vars);
    expect(colours).toMatchObject({
      headerLine: 'rgba(244,238,232,0.08)',
      bubbleLine: 'rgba(244,238,232,0.16)',
      fieldLine: 'rgba(244,238,232,0.14)',
      divider: 'rgba(244,238,232,0.07)',
      accentLine: 'rgba(255,106,31,0.4)',
      spinnerTrack: 'rgba(255,106,31,0.3)',
      reportGradient: ['rgba(255,106,31,0.16)', 'rgba(255,106,31,0.03)'],
    });
    expect(colours.failedFill).toMatch(/^rgba\(\d+,\d+,\d+,0\.1\)$/);
    expect(colours.failedLine).toMatch(/^rgba\(\d+,\d+,\d+,0\.45\)$/);
  });

  it("mixes the paper's rule and bars from the sheet's ink into the sheet", () => {
    const vars = playVars(EMBER);
    expect([vars.sheetBg, vars.sheetText]).toEqual(['#F4EEE8', '#131110']);
    const { paperRule, paperBar } = companionColours(vars);
    // Ember draws #CFC5BB and #B7ADA4: warmer, but as light as these
    expect(paperRule).toBe('#D0CBC5');
    expect(paperBar).toBe('#B7B2AE');
    expect(COMPANION_ALPHAS).toMatchObject({ paperRule: 0.16, paperBar: 0.27 });
  });

  it.each(PRESETS)('gives every preset React Native colours (%#)', (look) => {
    const colours = companionColours(playVars(look));
    const all = Object.values(colours).flat();
    expect(all.every((colour) => COLOUR.test(colour))).toBe(true);
  });

  it('builds once per variables object', () => {
    const vars = playVars(DAYLIGHT);
    expect(companionColours(vars)).toBe(companionColours(vars));
    expect(companionColours(playVars(DAYLIGHT))).toEqual(companionColours(vars));
  });
});
