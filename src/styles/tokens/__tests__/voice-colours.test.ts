// The voice core's colours in every style (US-018b, D-ONE-VOICE): HUD's variables, Play's look,
// Arcade's palette (the rings in its accent, the core filled with its window) and Studio's ink and
// orange; never a HUD constant outside HUD.

import { describe, expect, it } from 'vitest';

import { rgba } from '../../../core/web/lib/look-kit/css';
import { HUD, PLAY, PLAY_STYLES, STUDIO_DARK, STUDIO_LIGHT } from '../../dress/__tests__/fixtures';
import { ARCADE_DEFAULT_PICKS, arcadeVars, type ArcadePaintPicks } from '../arcade';
import { PALETTE_IDS } from '../arcade-catalogue';
import { CANDY_DEFAULT_PICKS, candyVars, type CandyPaintPicks } from '../candy';
import { PALETTE_IDS as CANDY_PALETTE_IDS } from '../candy-catalogue';
import { arcadeStyleTokens, candyStyleTokens } from '../style-tokens';
import { clearOf, voicePaint, type VoiceStyle } from '../voice-colours';

/** Arcade as the voice core reads it: the palette's set and its variables. */
function arcadeStyle(look: ArcadePaintPicks): VoiceStyle {
  return { tokens: arcadeStyleTokens(look), arcade: arcadeVars(look) };
}

/** Candy as the voice core reads it: the palette's set and its variables. */
function candyStyle(look: CandyPaintPicks): VoiceStyle {
  return { tokens: candyStyleTokens(look), candy: candyVars(look) };
}

describe('the voice core paint', () => {
  it("takes HUD's README variables in HUD", () => {
    const vars = HUD.hud;
    if (!vars) throw new Error('HUD has its variables');
    expect(voicePaint(HUD)).toEqual({
      accent: vars.accent,
      accentInk: vars.accentInk,
      accentLine: vars.accentLine,
      accentFill: vars.accentFill,
      glow: vars.glow,
      text: vars.text,
      text2: vars.text2,
      line: vars.line,
      coreFill: clearOf(vars.accent),
    });
    expect(voicePaint(HUD).accentLine).toBe('rgba(63,224,255,0.45)');
  });

  it.each(PLAY_STYLES.map((style, index) => [index, style] as const))(
    "takes the look's --pl-* variables in Play (%i)",
    (_, style) => {
      const vars = style.play;
      if (!vars) throw new Error('Play has its variables');
      expect(voicePaint(style)).toMatchObject({
        accent: vars.accent,
        accentLine: vars.accentLine,
        accentFill: vars.accentFill,
        glow: vars.glow,
        text: vars.groundText,
        text2: vars.groundText2,
        line: vars.groundLine,
        coreFill: clearOf(vars.accent),
      });
    },
  );

  it.each(PALETTE_IDS)("takes Arcade's palette in Arcade: rings in ac, the core in win (%s)", (id) => {
    const look = { ...ARCADE_DEFAULT_PICKS, palette: id };
    const vars = arcadeVars(look);
    expect(voicePaint(arcadeStyle(look))).toEqual({
      accent: vars.ac,
      accentInk: vars.aci,
      accentLine: rgba(vars.ac, 0.45),
      accentFill: rgba(vars.ac, 0.12),
      glow: clearOf(vars.ac),
      text: vars.tx,
      text2: vars.tx2,
      line: vars.bd,
      coreFill: vars.win,
    });
  });

  it("paints Overworld's rings green round its window", () => {
    const paint = voicePaint(arcadeStyle(ARCADE_DEFAULT_PICKS));
    expect(paint.accent).toBe('#7FE35C');
    expect(paint.accentLine).toBe('rgba(127,227,92,0.45)');
    expect(paint.coreFill).toBe('#15291B');
  });

  it.each(CANDY_PALETTE_IDS)("takes Candy's palette in Candy: the accent, the cards' starts, a clear core (%s)", (id) => {
    const look = { ...CANDY_DEFAULT_PICKS, palette: id };
    const vars = candyVars(look);
    expect(voicePaint(candyStyle(look))).toEqual({
      accent: vars.accent,
      accentInk: vars.accentInk,
      accentLine: rgba(vars.accent, 0.45),
      accentFill: rgba(vars.accent, 0.12),
      glow: clearOf(vars.accent),
      text: vars.text,
      text2: vars.quiet,
      line: vars.line,
      coreFill: clearOf(vars.accent),
      gradient: [vars.g1a, vars.g2a, vars.g3a],
    });
  });

  it("strokes Lilac's rings violet, blue and pink, or violet three times with One colour", () => {
    const lilac = { ...CANDY_DEFAULT_PICKS, palette: 'lilac' as const };
    expect(voicePaint(candyStyle(lilac)).gradient).toEqual(['#8E4AE8', '#2675D3', '#D73178']);
    const single = { ...lilac, cards: 'single' as const };
    expect(voicePaint(candyStyle(single)).gradient).toEqual(['#8E4AE8', '#8E4AE8', '#8E4AE8']);
    expect(voicePaint(arcadeStyle(ARCADE_DEFAULT_PICKS)).gradient).toBeUndefined();
    expect(voicePaint(STUDIO_LIGHT).gradient).toBeUndefined();
  });

  it.each([STUDIO_LIGHT, STUDIO_DARK])("paints Studio's orange with no glow (%#)", (style) => {
    const { colours } = style.tokens;
    const paint = voicePaint(style);
    expect(paint).toMatchObject({
      accent: colours.accent,
      accentInk: colours.accentForeground,
      text: colours.foreground,
      text2: colours.mutedForeground,
      line: colours.border,
      glow: clearOf(colours.accent),
      coreFill: clearOf(colours.accent),
    });
    expect(paint.accentLine).toMatch(/^rgba\(\d+,\d+,\d+,0\.45\)$/);
    expect(paint.accentFill).toMatch(/^rgba\(\d+,\d+,\d+,0\.12\)$/);
  });

  it('is built once per variables object', () => {
    expect(voicePaint(PLAY)).toBe(voicePaint(PLAY));
    expect(voicePaint(HUD)).toBe(voicePaint(HUD));
    const arcade = arcadeStyle(ARCADE_DEFAULT_PICKS);
    expect(voicePaint(arcade)).toBe(voicePaint({ ...arcade }));
    const candy = candyStyle(CANDY_DEFAULT_PICKS);
    expect(voicePaint(candy)).toBe(voicePaint({ ...candy }));
  });

  it('fades a colour to 0 in its own hue', () => {
    expect(clearOf('#3FE0FF')).toBe('rgba(63,224,255,0)');
  });
});
