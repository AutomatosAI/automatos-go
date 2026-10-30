// The dress's derived colours (US-016f): Ember's outline line at 24 % and chip line at 20 % of the
// ground's text, and HUD's selected-panel glow at half the accent, written as React Native reads
// them, for Ember's cream and ARC's cyan.

import { describe, expect, it } from 'vitest';

import { EMBER } from '../../../core/frozen/lib/looks/presets';
import { ARCADE_DEFAULT_PICKS, arcadeVars } from '../arcade';
import { CANDY_DEFAULT_PICKS, candyVars } from '../candy';
import {
  HUD_SELECTED_GLOW,
  PLAY_CHIP_LINE_ALPHA,
  PLAY_OUTLINE_ALPHA,
  arcadeSelectedColours,
  candySelectedColours,
  hudSelectedGlowColour,
  playDressLines,
} from '../dress-colours';
import { hudVars } from '../hud';
import { HUD_DEFAULT_PRESET_ID, HUD_PRESETS } from '../hud-catalogue';
import { playVars } from '../play';

describe('the dress colours', () => {
  it("draws Ember's outline and chip lines in its cream at 24 % and 20 %", () => {
    const vars = playVars(EMBER);
    expect(vars.groundText).toBe('#F4EEE8');
    expect(PLAY_OUTLINE_ALPHA).toBe(0.24);
    expect(PLAY_CHIP_LINE_ALPHA).toBe(0.2);
    expect(playDressLines(vars)).toEqual({
      outline: 'rgba(244,238,232,0.24)',
      chip: 'rgba(244,238,232,0.2)',
    });
  });

  it("glows round ARC's selected panel in its cyan at half", () => {
    const arc = HUD_PRESETS.find((preset) => preset.id === HUD_DEFAULT_PRESET_ID);
    if (!arc) throw new Error('no ARC preset');
    const { accent } = hudVars(arc);
    expect(accent).toBe('#3FE0FF');
    expect(HUD_SELECTED_GLOW).toEqual({ blurRadius: 24, spreadDistance: -6, alpha: 0.5 });
    expect(hudSelectedGlowColour(accent)).toBe('rgba(63,224,255,0.5)');
  });

  it("selects in Arcade's highlight with its ink: Overworld's green under its dark green", () => {
    const selected = arcadeSelectedColours(arcadeVars(ARCADE_DEFAULT_PICKS));
    expect(selected).toEqual({ fill: '#7FE35C', ink: '#0B1A07' });
    expect(Object.isFrozen(selected)).toBe(true);
  });

  it("selects in Candy's accent with its ink: Blush's pink under white, Night bloom's under plum", () => {
    const selected = candySelectedColours(candyVars(CANDY_DEFAULT_PICKS));
    expect(selected).toEqual({ fill: '#D62F7A', ink: '#FFFFFF' });
    expect(Object.isFrozen(selected)).toBe(true);
    const night = candyVars({ ...CANDY_DEFAULT_PICKS, palette: 'nightbloom' });
    expect(candySelectedColours(night)).toEqual({ fill: '#FF6FB5', ink: '#2A0618' });
  });
});
