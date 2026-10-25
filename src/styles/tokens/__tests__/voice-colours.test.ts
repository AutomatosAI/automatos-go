// The voice core's colours in every style (US-018b, D-ONE-VOICE): HUD's variables, Play's look and
// Studio's ink and orange; never a HUD constant outside HUD.

import { describe, expect, it } from 'vitest';

import { HUD, PLAY, PLAY_STYLES, STUDIO_DARK, STUDIO_LIGHT } from '../../dress/__tests__/fixtures';
import { clearOf, voicePaint } from '../voice-colours';

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
      });
    },
  );

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
    });
    expect(paint.accentLine).toMatch(/^rgba\(\d+,\d+,\d+,0\.45\)$/);
    expect(paint.accentFill).toMatch(/^rgba\(\d+,\d+,\d+,0\.12\)$/);
  });

  it('is built once per variables object', () => {
    expect(voicePaint(PLAY)).toBe(voicePaint(PLAY));
    expect(voicePaint(HUD)).toBe(voicePaint(HUD));
  });

  it('fades a colour to 0 in its own hue', () => {
    expect(clearOf('#3FE0FF')).toBe('rgba(63,224,255,0)');
  });
});
