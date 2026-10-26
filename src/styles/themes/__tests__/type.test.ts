// An installed theme's fonts on the Studio layout (D58, D-FONTS): the families are
// 'theme-<installId>-<role>'; while the theme is the style, Studio's sans, serif and mono faces
// give way to the loaded roles (sizes, leading and the 11 pt floor stay Studio's); a role not
// loaded, a painting not loaded, or another install's fonts keep Studio's faces.

import { describe, expect, it } from 'vitest';

import { resolveStyle, type StyleInput } from '../../provider/resolve';
import { HUD_DEFAULT_LOOK } from '../../hud/look-schema';
import { DEFAULT_LOOK } from '../../../core/frozen/lib/looks/presets';
import { builtinChoice, themeChoice } from '../../registry/style-id';
import { STUDIO_TYPE } from '../../type';
import { STUDIO_STYLE_TYPE } from '../../typeface/studio-type';
import { themePaint } from '../paint';
import { themeFontFamily, themedStyleType, themedTypeScale } from '../type';
import type { LoadedThemeFonts } from '../types';
import { FONT_URL, HARBOUR_ID, MOSS_ID, answer } from './fixtures';

const SANS = themeFontFamily(HARBOUR_ID, 'sans');
const SERIF = themeFontFamily(HARBOUR_ID, 'serif');
const FAMILIES = Object.freeze({ sans: SANS, serif: SERIF });

function input(fonts: LoadedThemeFonts | null, installId = HARBOUR_ID): StyleInput {
  const paint = themePaint(answer(HARBOUR_ID, { fonts: { sans: FONT_URL } }));
  return {
    choice: themeChoice(installId),
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: DEFAULT_LOOK,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: paint,
    themeFonts: fonts,
    reduceMotion: false,
  };
}

describe('the family names', () => {
  it("are 'theme-<installId>-<role>'", () => {
    expect(SANS).toBe(`theme-${HARBOUR_ID}-sans`);
    expect(themeFontFamily(MOSS_ID, 'mono')).toBe(`theme-${MOSS_ID}-mono`);
  });
});

describe("the Studio scale with a theme's families", () => {
  it('swaps the sans and serif roles and keeps mono, sizes and leading Studio’s', () => {
    const themed = themedTypeScale(STUDIO_TYPE, FAMILIES);
    expect(themed.body1).toEqual({ ...STUDIO_TYPE.body1, fontFamily: SANS });
    expect(themed.thread.fontFamily).toBe(SANS);
    expect(themed.title1).toEqual({ ...STUDIO_TYPE.title1, fontFamily: SERIF });
    expect(themed.label).toBe(STUDIO_TYPE.label);
    expect(themed.figure1.fontFamily).toBe(STUDIO_TYPE.figure1.fontFamily);
    expect(
      Math.min(...Object.values(themed).map((style) => style.fontSize)),
    ).toBeGreaterThanOrEqual(11);
  });

  it('is the same object for the same scale and families (memoised styles hold)', () => {
    expect(themedTypeScale(STUDIO_TYPE, FAMILIES)).toBe(themedTypeScale(STUDIO_TYPE, FAMILIES));
    const type = themedStyleType(STUDIO_STYLE_TYPE, FAMILIES);
    expect(type).toBe(themedStyleType(STUDIO_STYLE_TYPE, FAMILIES));
    expect(type.title('title2')).toBe(type.title('title2'));
  });

  it("swaps a style type's title, display, body, mono, label and button by role", () => {
    const mono = themeFontFamily(HARBOUR_ID, 'mono');
    const type = themedStyleType(STUDIO_STYLE_TYPE, { ...FAMILIES, mono });
    expect(type.title('title3').fontFamily).toBe(SERIF);
    expect(type.display('lostNumber').fontFamily).toBe(SERIF);
    expect(type.body(14).fontFamily).toBe(SANS);
    expect(type.body(14, 600).fontFamily).toBe(SANS);
    expect(type.mono(12).fontFamily).toBe(mono);
    expect(type.label.fontFamily).toBe(mono);
    expect(type.button.fontFamily).toBe(SANS);
    expect(type.body(9).fontSize).toBe(11);
  });
});

describe('resolveStyle with a theme and its fonts', () => {
  it('paints the loaded families into useTokens().type and useStyle().type', () => {
    const style = resolveStyle(input({ installId: HARBOUR_ID, families: FAMILIES }));
    expect(style.layout).toBe('studio');
    expect(style.tokens.type.body1.fontFamily).toBe(SANS);
    expect(style.type.title('title1').fontFamily).toBe(SERIF);
  });

  it("keeps Studio's faces before the fonts load, for another install's fonts, or none loaded", () => {
    for (const fonts of [
      null,
      { installId: MOSS_ID, families: FAMILIES },
      { installId: HARBOUR_ID, families: {} },
    ]) {
      const style = resolveStyle(input(fonts));
      expect(style.tokens.type).toBe(STUDIO_TYPE);
      expect(style.type).toBe(STUDIO_STYLE_TYPE);
    }
  });

  it('never applies a theme’s fonts to a built-in style', () => {
    const style = resolveStyle({
      ...input({ installId: HARBOUR_ID, families: FAMILIES }),
      choice: builtinChoice('studio'),
    });
    expect(style.tokens.type).toBe(STUDIO_TYPE);
  });
});
