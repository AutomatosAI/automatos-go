// What the edge screens paint with (US-017f), over every built-in style and look: Play reads its
// look's variables, HUD its README's, Arcade its palette's (US-022i: its window the ground),
// Studio (and an installed theme) the Studio-keyed set; the words stay readable — the title, the
// text and the snag's title on the ground, the command on its box — at AA (4.5:1) in every style,
// Arcade's brand line on its page too; and the paint is built once per style object.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import {
  ALL_STYLES,
  ARCADE,
  ARCADE_STYLES,
  HUD,
  PLAY,
  PLAY_STYLES,
  STUDIO_DARK,
  STUDIO_LIGHT,
} from '../../dress/__tests__/fixtures';
import { edgePaint } from '../paint';

const AA = 4.5;

function groundOf(style: (typeof ALL_STYLES)[number]): string {
  if (style.play) return style.play.groundBg;
  if (style.hud) return style.hud.bg;
  // Arcade's words sit in a window (ArcadeEdgeWindow.tsx)
  if (style.arcade) return style.arcade.win;
  return style.tokens.colours.background;
}

describe('edgePaint', () => {
  it("reads Play's look variables", () => {
    const paint = edgePaint(PLAY);
    const vars = PLAY.play;
    expect(vars).toBeDefined();
    expect(paint).toMatchObject({
      text: vars?.groundText,
      text2: vars?.groundText2,
      accentText: vars?.accentText,
      snagTitle: vars?.errorText,
    });
  });

  it("reads HUD's README variables", () => {
    const paint = edgePaint(HUD);
    const vars = HUD.hud;
    expect(vars).toBeDefined();
    expect(paint).toMatchObject({
      text: vars?.text,
      text2: vars?.text2,
      accentText: vars?.accent,
      snagTitle: vars?.error,
    });
  });

  it("reads Arcade's palette: its text on the window, the accent, HP red, the page as the box", () => {
    const paint = edgePaint(ARCADE);
    const vars = ARCADE.arcade;
    expect(vars).toBeDefined();
    expect(paint).toMatchObject({
      text: vars?.tx,
      text2: vars?.tx2,
      text3: vars?.tx2,
      accentText: vars?.ac,
      snagTitle: vars?.hp,
      commandFill: vars?.page,
    });
    expect(paint.snagTitle).not.toBe(ARCADE.tokens.colours.foreground);
  });

  it("keeps Arcade's brand line and status word readable on its page in every palette", () => {
    const low: string[] = [];
    for (const style of ARCADE_STYLES) {
      const paint = edgePaint(style);
      const page = style.tokens.colours.background;
      expect(page).toBe(style.arcade?.page);
      for (const [name, fg] of [
        ['text', paint.text],
        ['text2', paint.text2],
        ['accentText', paint.accentText],
      ] as const) {
        const ratio = contrastRatio(fg, page);
        if (ratio < AA) low.push(`${style.arcadeLook?.palette} ${name} ${ratio.toFixed(2)}`);
      }
    }
    expect(low).toEqual([]);
  });

  it("reads Studio's tokens, its ink for the snag's title and its muted fill for the command", () => {
    for (const style of [STUDIO_LIGHT, STUDIO_DARK]) {
      const { colours } = style.tokens;
      expect(edgePaint(style)).toMatchObject({
        text: colours.foreground,
        text2: colours.mutedForeground,
        snagTitle: colours.foreground,
        commandFill: colours.muted,
      });
    }
  });

  it("shades the command box below a dark Play ground, Paper's on its surface", () => {
    for (const style of PLAY_STYLES) {
      const paint = edgePaint(style);
      if (style.tone === 'light') expect(paint.commandFill).toBe(style.play?.groundSurface);
      else expect(paint.commandFill).not.toBe(style.play?.groundBg);
    }
  });

  it('keeps every word readable at AA in every style and look', () => {
    const low: string[] = [];
    for (const style of ALL_STYLES) {
      const paint = edgePaint(style);
      const ground = groundOf(style);
      const pairs: readonly (readonly [string, string, string])[] = [
        ['text', paint.text, ground],
        ['text2', paint.text2, ground],
        ['snagTitle', paint.snagTitle, ground],
        ['command', paint.text, paint.commandFill],
      ];
      for (const [name, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < AA) low.push(`${style.choice.kind}/${style.layout} ${name} ${ratio.toFixed(2)}`);
      }
    }
    expect(low).toEqual([]);
  });

  it('is built once per style object', () => {
    expect(edgePaint(PLAY)).toBe(edgePaint(PLAY));
  });
});
