// Each style's whole token set: Play and HUD in the foundation's Tokens shape (Studio's keys, the
// style's radii, the foundation's spacing, shadows and type, the thread paint from the look's
// colours), through the same tokensFor accessor as Studio, one object per look.

import { describe, expect, it } from 'vitest';

import { DAYLIGHT, DEFAULT_LOOK, EMBER } from '../../../core/frozen/lib/looks/presets';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS } from '../../hud/look-schema';
import { STUDIO_TYPE } from '../../type';
import { HUD_TONE, hudTokens } from '../hud';
import { STYLE_IDS, tokensFor } from '../index';
import { playTokens } from '../play';
import { STYLE_RADII } from '../radii';
import {
  STUDIO_COLOURS,
  STUDIO_SHADOWS,
  STUDIO_SPACING,
  STUDIO_THREAD,
  studioTokens,
} from '../studio';
import { hudStyleTokens, paintedStudioTokens, playStyleTokens } from '../style-tokens';
import { threadPaint } from '../thread';

const STUDIO_KEYS = Object.keys(studioTokens('light')).sort();
const COLOUR_KEYS = Object.keys(STUDIO_COLOURS.light).sort();

describe('the accessor knows every built-in style', () => {
  it('lists Studio, Play, HUD and Arcade', () => {
    expect([...STYLE_IDS].sort()).toEqual(['arcade', 'hud', 'play', 'studio']);
  });

  // ARCADE_STAND_IN US-022b: Arcade's own palettes replace Studio's set here
  it("gives Arcade Studio's set under Arcade's name, the same object each time", () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = tokensFor('arcade', scheme);
      expect(tokens.style).toBe('arcade');
      expect(tokens.colours).toBe(studioTokens(scheme).colours);
      expect(tokensFor('arcade', scheme)).toBe(tokens);
      expect(Object.isFrozen(tokens)).toBe(true);
    }
  });

  it("gives Play its default look, Ember, in the ground's tone whatever the scheme", () => {
    expect(tokensFor('play', 'light')).toBe(playStyleTokens(DEFAULT_LOOK));
    expect(tokensFor('play', 'dark')).toBe(tokensFor('play', 'light'));
    expect(DEFAULT_LOOK).toBe(EMBER);
    expect(tokensFor('play', 'light').scheme).toBe('dark');
  });

  it('gives HUD ARC, always dark', () => {
    const tokens = tokensFor('hud', 'light');
    expect(tokens).toBe(tokensFor('hud', 'dark'));
    expect(tokens.scheme).toBe(HUD_TONE);
    expect(tokens.colours).toEqual(hudTokens(HUD_DEFAULT_LOOK));
  });
});

describe("Play's and HUD's sets have the foundation's shape", () => {
  it.each([EMBER, DAYLIGHT])('$name', (look) => {
    const tokens = playStyleTokens(look);
    expect(Object.keys(tokens).sort()).toEqual(STUDIO_KEYS);
    expect(Object.keys(tokens.colours).sort()).toEqual(COLOUR_KEYS);
    expect(tokens.style).toBe('play');
    expect(tokens.colours).toEqual(playTokens(look));
    expect(tokens.radii).toBe(STYLE_RADII.play);
    expect(tokens.spacing).toBe(STUDIO_SPACING);
    expect(tokens.shadows).toBe(STUDIO_SHADOWS);
    expect(tokens.type).toBe(STUDIO_TYPE);
    expect(tokens.thread).toEqual(threadPaint(tokens.colours, STUDIO_THREAD.light.sail));
    expect(Object.isFrozen(tokens)).toBe(true);
  });

  it.each(HUD_PRESET_LOOKS)('$name', (look) => {
    const tokens = hudStyleTokens(look);
    expect(Object.keys(tokens).sort()).toEqual(STUDIO_KEYS);
    expect(tokens.style).toBe('hud');
    expect(tokens.scheme).toBe('dark');
    expect(tokens.colours).toEqual(hudTokens(look));
    expect(tokens.radii).toBe(STYLE_RADII.hud);
    expect(tokens.thread).toEqual(threadPaint(tokens.colours, STUDIO_THREAD.dark.sail));
  });

  it('builds one set per look object', () => {
    expect(playStyleTokens(EMBER)).toBe(playStyleTokens(EMBER));
    expect(playStyleTokens({ ...EMBER })).not.toBe(playStyleTokens(EMBER));
    expect(playStyleTokens({ ...EMBER })).toEqual(playStyleTokens(EMBER));
    expect(hudStyleTokens(HUD_DEFAULT_LOOK)).toBe(hudStyleTokens(HUD_DEFAULT_LOOK));
  });
});

describe("an installed theme's colours on the Studio layout", () => {
  const colours = playTokens(DAYLIGHT);

  it('is a Studio set in the scheme asked for, with Studio radii', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = paintedStudioTokens(colours, scheme);
      expect(Object.keys(tokens).sort()).toEqual(STUDIO_KEYS);
      expect(tokens.style).toBe('studio');
      expect(tokens.scheme).toBe(scheme);
      expect(tokens.colours).toBe(colours);
      expect(tokens.radii).toBe(STYLE_RADII.studio);
    }
  });

  it('builds one set per painting and scheme', () => {
    expect(paintedStudioTokens(colours, 'light')).toBe(paintedStudioTokens(colours, 'light'));
    expect(paintedStudioTokens(colours, 'dark')).not.toBe(paintedStudioTokens(colours, 'light'));
  });
});
