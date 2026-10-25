// Painting a theme's mobile answer (D58, docs/theme-host/mobile.md): triplets through the vendored
// tripletToHex, #rrggbb as written, garbage dropped and logged; only the 24 MOBILE_TOKEN_NAMES
// read; no --background or --foreground → not offered; Studio's colours where the theme sets none;
// the tone rules ('tokens' follows the user, System the device, a missing scheme holds the other's;
// 'fromLooks' paints its tone); the 10 contrast pairs logged under AA; only allowlisted file URLs.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { tripletToHex } from '../../../core/web/lib/look-kit/hsl';
import { logger } from '../../../lib/logger';
import { STUDIO_COLOURS } from '../../tokens/studio';
import {
  MOBILE_CONTRAST_PAIRS,
  MOBILE_TOKEN_NAMES,
  contrastProblems,
  paintScheme,
  themeColour,
  themePaint,
  themeTokens,
} from '../paint';
import {
  DAY_TOKENS,
  FONT_URL,
  HARBOUR_ID,
  NIGHT_TOKENS,
  SERIF_URL,
  answer,
  fileUrl,
  hex,
} from './fixtures';

function warnings() {
  return vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
}

function painted(mobile: Parameters<typeof answer>[1]) {
  const paint = themePaint(answer(HARBOUR_ID, mobile));
  if (!paint) throw new Error('expected a painting');
  return paint;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a value', () => {
  it("reads 'H S% L%' through the vendored converter and #rrggbb as written", () => {
    expect(themeColour('220 20% 10%')).toBe(tripletToHex('220 20% 10%'));
    expect(themeColour('0 0% 100%')).toBe(hex('FFFFFF'));
    expect(themeColour(hex('14181c'))).toBe(hex('14181C'));
    expect(themeColour(hex('A1B2C3'))).toBe(hex('A1B2C3'));
  });

  it('drops anything else', () => {
    for (const value of [
      'red',
      hex('fff'),
      hex('14181c80'),
      // the CSS functions, built so no colour literal sits in a test file
      ['hsl', '(0 0% 100%)'].join(''),
      ['rgb', '(1, 2, 3)'].join(''),
      '361 0% 0%',
      '0 101% 0%',
      '0 0 0',
      '',
      42,
      null,
      { h: 0 },
    ]) {
      expect(themeColour(value)).toBeNull();
    }
  });
});

describe('the tokens a theme sets', () => {
  it('reads only the 24 MOBILE_TOKEN_NAMES; the rest stays Studio', () => {
    expect(MOBILE_TOKEN_NAMES).toHaveLength(24);
    const paint = painted({
      tokens: {
        light: { ...DAY_TOKENS, '--success': '0 100% 50%', '--chart-1': '0 100% 50%' },
        dark: null,
      },
    });
    expect(paint.colours.light.success).toBe(STUDIO_COLOURS.light.success);
    expect(paint.colours.light.chart1).toBe(STUDIO_COLOURS.light.chart1);
    expect(paint.colours.light.background).toBe(hex('FFFFFF'));
    expect(paint.colours.light.foreground).toBe(hex('14181C'));
  });

  it("keeps every Studio colour the theme leaves out, in that scheme's Studio value", () => {
    const paint = painted({});
    expect(paint.colours.light.accent).toBe(STUDIO_COLOURS.light.accent);
    expect(paint.colours.dark.accent).toBe(STUDIO_COLOURS.dark.accent);
    expect(paint.colours.dark.background).toBe(tripletToHex(NIGHT_TOKENS['--background']));
    expect(Object.keys(paint.colours.light).sort()).toEqual(
      Object.keys(STUDIO_COLOURS.light).sort(),
    );
  });

  it('drops the names Studio has no colour for (gradients, glass), as Play does', () => {
    const paint = painted({
      tokens: {
        light: { ...DAY_TOKENS, '--background-gradient-from': '0 0% 50%' },
        dark: null,
      },
    });
    expect(paint.colours.light).not.toHaveProperty('backgroundGradientFrom');
  });

  it('drops and logs a value that is neither form, naming the token, never its value', () => {
    const warn = warnings();
    const paint = painted({
      tokens: { light: { ...DAY_TOKENS, '--accent': 'url(https://evil.example/x)' }, dark: null },
    });
    expect(paint.colours.light.accent).toBe(STUDIO_COLOURS.light.accent);
    const messages = warn.mock.calls.map(([message]) => String(message));
    expect(messages.some((message) => message.includes('--accent'))).toBe(true);
    expect(messages.some((message) => message.includes('evil'))).toBe(false);
  });
});

describe('what is not offered', () => {
  it('a painting without --background or --foreground', () => {
    warnings();
    const { '--background': _ground, ...noGround } = DAY_TOKENS;
    const { '--foreground': _text, ...noText } = DAY_TOKENS;
    expect(themePaint(answer(HARBOUR_ID, { tokens: { light: noGround, dark: null } }))).toBeNull();
    expect(themePaint(answer(HARBOUR_ID, { tokens: { light: noText, dark: null } }))).toBeNull();
    const garbage = { ...DAY_TOKENS, '--background': 'teal' };
    expect(themePaint(answer(HARBOUR_ID, { tokens: { light: garbage, dark: null } }))).toBeNull();
  });

  it('an answer with no mobile block, or no scheme at all', () => {
    warnings();
    expect(themePaint(answer(HARBOUR_ID, null))).toBeNull();
    expect(themePaint(answer(HARBOUR_ID, { tokens: { light: null, dark: null } }))).toBeNull();
  });

  it('keeps the scheme it can paint when the other lacks its ground', () => {
    warnings();
    const { '--background': _ground, ...noGround } = NIGHT_TOKENS;
    const paint = painted({ tokens: { light: DAY_TOKENS, dark: noGround } });
    expect(paint.colours.dark).toBe(paint.colours.light);
  });
});

describe('the tone rules', () => {
  it("'tokens': the user's Light / Dark / System picks the scheme (System: the device)", () => {
    const harbour = answer(HARBOUR_ID, {});
    expect(paintScheme(painted({}), 'light', 'dark')).toBe('light');
    expect(themeTokens(harbour, 'light', 'dark')?.background).toBe(hex('FFFFFF'));
    expect(themeTokens(harbour, 'dark', 'light')?.background).toBe(
      tripletToHex(NIGHT_TOKENS['--background']),
    );
    expect(themeTokens(harbour, 'system', 'dark')?.background).toBe(
      tripletToHex(NIGHT_TOKENS['--background']),
    );
    expect(themeTokens(harbour, 'system', 'light')?.background).toBe(hex('FFFFFF'));
    expect(themeTokens(harbour, 'system', null)?.background).toBe(hex('FFFFFF'));
  });

  it("'tokens': a null scheme falls back to the other", () => {
    const lightOnly = answer(HARBOUR_ID, { tokens: { light: DAY_TOKENS, dark: null } });
    const darkOnly = answer(HARBOUR_ID, { tokens: { light: null, dark: NIGHT_TOKENS } });
    expect(themeTokens(lightOnly, 'dark', 'dark')?.background).toBe(hex('FFFFFF'));
    expect(themeTokens(darkOnly, 'light', 'light')?.background).toBe(
      tripletToHex(NIGHT_TOKENS['--background']),
    );
    expect(themePaint(lightOnly)?.tone).toBeNull();
  });

  it("'fromLooks': the tone's scheme, whatever the phone's", () => {
    const look = answer(HARBOUR_ID, {
      source: 'fromLooks',
      tone: 'dark',
      tokens: { light: null, dark: NIGHT_TOKENS },
    });
    expect(themePaint(look)?.tone).toBe('dark');
    for (const scheme of ['light', 'dark', 'system'] as const) {
      expect(themeTokens(look, scheme, 'light')?.background).toBe(
        tripletToHex(NIGHT_TOKENS['--background']),
      );
    }
  });

  it("'fromLooks' without a tone paints the scheme it was given", () => {
    const look = answer(HARBOUR_ID, {
      source: 'fromLooks',
      tone: null,
      tokens: { light: DAY_TOKENS, dark: null },
    });
    expect(themePaint(look)?.tone).toBe('light');
  });
});

describe('contrast (the 10 MOBILE_CONTRAST_PAIRS, measured with the vendored contrastRatio)', () => {
  it('lists the pairs core lists', () => {
    expect(MOBILE_CONTRAST_PAIRS).toHaveLength(10);
  });

  it('passes a readable painting and logs nothing for it', () => {
    const warn = warnings();
    const paint = painted({ tokens: { light: DAY_TOKENS, dark: NIGHT_TOKENS } });
    const themed = new Set([...Object.keys(DAY_TOKENS), ...Object.keys(NIGHT_TOKENS)]);
    expect(contrastProblems(paint.colours.light, themed)).toEqual([]);
    expect(contrastProblems(paint.colours.dark, themed)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves a pair wholly Studio's to Studio (its Light muted pair is the handoff's own)", () => {
    const muted = expect.stringMatching(/^--muted-foreground on --muted /);
    expect(contrastProblems(STUDIO_COLOURS.light)).toContainEqual(muted);
    const themed = contrastProblems(STUDIO_COLOURS.light, new Set(Object.keys(DAY_TOKENS)));
    expect(themed).not.toContainEqual(muted);
    expect(contrastProblems(STUDIO_COLOURS.light, new Set(['--muted']))).toContainEqual(muted);
  });

  it('logs a pair under AA but still paints it (core reviewed what it serves)', () => {
    const warn = warnings();
    const faint = { ...DAY_TOKENS, '--foreground': '0 0% 90%' };
    const paint = painted({ tokens: { light: faint, dark: null } });
    expect(paint.colours.light.foreground).toBe(tripletToHex('0 0% 90%'));
    expect(contrastProblems(paint.colours.light)).toContainEqual(
      expect.stringMatching(/^--foreground on --background \d/),
    );
    expect(warn.mock.calls.some(([m]) => String(m).includes('under AA'))).toBe(true);
  });
});

describe('the files a painting keeps', () => {
  it('keeps allowed font URLs by role and drops the rest', () => {
    const paint = painted({
      fonts: { sans: FONT_URL, serif: SERIF_URL, mono: 'https://evil.example/mono.ttf' },
    });
    expect(paint.fonts).toEqual({ sans: FONT_URL, serif: SERIF_URL });
  });

  it("keeps a mascot's allowed clips and stills; 'stills' never keeps a clip; 'none' none", () => {
    const states = [
      {
        name: 'idle',
        clip: fileUrl('assets/mascot/idle.mp4'),
        still: fileUrl('assets/mascot/idle.png'),
      },
      { name: 'oops', clip: fileUrl('dist/entry.js'), still: fileUrl('assets/mascot/oops.png') },
    ];
    const clips = painted({ mascot: { mode: 'clips', states } });
    expect(clips.mascot).toBe(true);
    expect(clips.mascotFiles).toEqual({
      mode: 'clips',
      states: [
        { name: 'idle', clip: states[0].clip, still: states[0].still },
        { name: 'oops', clip: null, still: states[1].still },
      ],
    });
    const stills = painted({ mascot: { mode: 'stills', states } });
    expect(stills.mascotFiles?.states.every((state) => state.clip === null)).toBe(true);
    const none = painted({ mascot: { mode: 'none', states } });
    expect(none.mascot).toBe(false);
    expect(none.mascotFiles).toBeNull();
  });

  it('brings no Auto when no state has a file the phone may load', () => {
    const paint = painted({
      mascot: { mode: 'clips', states: [{ name: 'idle', clip: 'idle.mp4', still: null }] },
    });
    expect(paint.mascot).toBe(false);
    expect(paint.mascotFiles).toBeNull();
  });

  it('hands back frozen paintings', () => {
    const paint = painted({});
    expect(Object.isFrozen(paint)).toBe(true);
    expect(Object.isFrozen(paint.colours)).toBe(true);
    expect(Object.isFrozen(paint.colours.light)).toBe(true);
  });
});
