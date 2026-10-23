// Studio's tokens against their source: every token in Light and Dark, the hex the web renders for
// each hsl(var(--x)) (checked by a second HSL formula, not the vendored one), the README's
// published hexes, the radii, spacing and shadows, and the type scale's 11 pt floor (D38).

import { describe, expect, it } from 'vitest';

import { FONT_FACES } from '../fonts';
import { tokensFor } from '../tokens';
import {
  STUDIO_COLOURS,
  STUDIO_RADII,
  STUDIO_SHADOWS,
  STUDIO_SPACING,
  normaliseColours,
  sourceToHex,
  tokenName,
} from '../tokens/studio';
import {
  STUDIO_DARK_SOURCE,
  STUDIO_LIGHT_SOURCE,
  STUDIO_SOURCE_FILE,
} from '../tokens/studio-source';
import {
  MIN_TEXT_SIZE,
  STUDIO_TYPE,
  TEXT_SCALING,
  TYPE_SPECS,
  typeStyle,
  type TypeRole,
} from '../type';

const HEX6 = /^#[0-9A-F]{6}$/;
const HEX8 = /^#[0-9A-F]{8}$/;
const SOURCE_VALUE = /^(?:\d+(?:\.\d+)? \d+(?:\.\d+)?% \d+(?:\.\d+)?%|hsl\(.+\))$/;

/**
 * The classic hue2rgb formulation of HSL → sRGB (a different route from look-kit's, which follows
 * CSS Color 4's sample): two independent conversions agreeing is the check that a token is the
 * colour the web paints.
 */
function oracleHex(value: string): string {
  const match = /^(?:hsl\()?([\d.]+) ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+))?\)?$/.exec(value);
  if (!match) throw new Error(`unreadable source value ${value}`);
  const [h, s, l] = [Number(match[1]) / 360, Number(match[2]) / 100, Number(match[3]) / 100];
  const hue2rgb = (p: number, q: number, t0: number) => {
    const t = t0 < 0 ? t0 + 1 : t0 > 1 ? t0 - 1 : t0;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = s === 0 ? [l, l, l] : [h + 1 / 3, h, h - 1 / 3].map((t) => hue2rgb(p, q, t));
  const alpha = match[4] === undefined ? [] : [Number(match[4])];
  return hexOf([...rgb, ...alpha].map((v) => Math.round(v * 255)));
}

/** Bytes to #RRGGBB(AA): expected colours are written as bytes, as brand-assets.test.ts does. */
function hexOf(bytes: readonly number[]): string {
  return `#${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
}

const WHITE = [0xff, 0xff, 0xff];
const BLACK = [0x00, 0x00, 0x00];

/** The README's labels are rounded from the triplets by eye: within 5/255 per channel of them. */
const README_LABEL_TOLERANCE = 5;

/** README 'Design Tokens' (and colors.css comments): the hex each Studio Light token is labelled. */
const README_LIGHT_BYTES = {
  background: [0xf4, 0xee, 0xe2],
  secondary: [0xeb, 0xe3, 0xd2],
  border: [0xdc, 0xd2, 0xbd],
  muted: [0xdc, 0xd2, 0xbd],
  foreground: [0x1a, 0x18, 0x14],
  accent: [0xc4, 0x4a, 0x1a],
  success: [0x5b, 0x6f, 0x3a],
  info: [0x1d, 0x36, 0x58],
} as const;

describe('Studio colour tokens', () => {
  it('names its source file', () => {
    expect(STUDIO_SOURCE_FILE).toMatch(
      /_ds\/automatos-studio-design-system-[0-9a-f-]+\/tokens\/colors\.css$/,
    );
  });

  it('keeps the source as written: Light 48 values, Dark 47 (it does not redefine --running)', () => {
    const light = Object.keys(STUDIO_LIGHT_SOURCE);
    const dark = Object.keys(STUDIO_DARK_SOURCE);
    expect(light).toHaveLength(48);
    expect(dark).toHaveLength(47);
    expect(light.filter((key) => !dark.includes(key))).toEqual(['--running']);
    for (const value of [
      ...Object.values(STUDIO_LIGHT_SOURCE),
      ...Object.values(STUDIO_DARK_SOURCE),
    ]) {
      expect(value).toMatch(SOURCE_VALUE);
    }
  });

  it('has every token in Light and in Dark, as hex', () => {
    const names = Object.keys(STUDIO_LIGHT_SOURCE).map(tokenName).sort();
    for (const scheme of ['light', 'dark'] as const) {
      const colours = STUDIO_COLOURS[scheme];
      expect(Object.keys(colours).sort()).toEqual(names);
      for (const [name, hex] of Object.entries(colours)) {
        expect(hex, `${scheme} ${name}`).toMatch(name === 'accent2' ? HEX8 : HEX6);
      }
    }
  });

  it('converts every value to the colour the web paints for it (a second HSL formula agrees)', () => {
    for (const [key, value] of Object.entries(STUDIO_LIGHT_SOURCE)) {
      expect(STUDIO_COLOURS.light[tokenName(key) as keyof typeof STUDIO_COLOURS.light]).toBe(
        oracleHex(value),
      );
    }
    for (const [key, value] of Object.entries(STUDIO_DARK_SOURCE)) {
      expect(STUDIO_COLOURS.dark[tokenName(key) as keyof typeof STUDIO_COLOURS.dark]).toBe(
        oracleHex(value),
      );
    }
  });

  it('lands on the README published hexes, within the rounding of the source triplets', () => {
    for (const [name, label] of Object.entries(README_LIGHT_BYTES)) {
      const rendered = channels(STUDIO_COLOURS.light[name as keyof typeof README_LIGHT_BYTES]);
      label.forEach((channel, index) => {
        expect(
          Math.abs(channel - rendered[index]),
          `${name} vs ${hexOf(label)}`,
        ).toBeLessThanOrEqual(README_LABEL_TOLERANCE);
      });
    }
  });

  it('paints the README Studio Dark ground (30 12% 9%) and inverts the primary CTA to cream', () => {
    expect(STUDIO_DARK_SOURCE['--background']).toBe('30 12% 9%');
    expect(STUDIO_COLOURS.dark.background).toBe(oracleHex('30 12% 9%'));
    expect(STUDIO_COLOURS.dark.background).toBe(STUDIO_COLOURS.light.foreground);
    expect(STUDIO_COLOURS.dark.primary).toBe(oracleHex('38 40% 90%'));
  });

  it('cascades --running into Dark from Light, as CSS does', () => {
    expect(STUDIO_COLOURS.dark.running).toBe(STUDIO_COLOURS.light.running);
  });

  it('keeps the source alpha as #RRGGBBAA', () => {
    expect(STUDIO_COLOURS.light.accent2).toBe(`${oracleHex('15 76% 44%')}1A`);
    expect(STUDIO_COLOURS.dark.accent2).toBe(`${oracleHex('15 80% 56%')}24`);
  });
});

describe('the normaliser', () => {
  it('names tokens as layouts read them', () => {
    expect(tokenName('--background')).toBe('background');
    expect(tokenName('--muted-foreground')).toBe('mutedForeground');
    expect(tokenName('--cc-hover-border')).toBe('ccHoverBorder');
    expect(tokenName('--chart-1')).toBe('chart1');
    expect(tokenName('--bg-2')).toBe('bg2');
  });

  it('reads bare triplets, wrapped values and wrapped values with an alpha', () => {
    expect(sourceToHex('0 0% 100%')).toBe(hexOf(WHITE));
    expect(sourceToHex(STUDIO_LIGHT_SOURCE['--paper'])).toBe(hexOf(WHITE));
    expect(sourceToHex(STUDIO_LIGHT_SOURCE['--accent-2'])).toBe(hexOf([0xc5, 0x46, 0x1b, 0x1a]));
  });

  it('throws on a value it cannot read, so a bad token fails at load, not on screen', () => {
    expect(() => sourceToHex(hexOf(WHITE))).toThrow();
    expect(() => sourceToHex(STUDIO_LIGHT_SOURCE['--accent-2'].replace('0.10', '2'))).toThrow(
      RangeError,
    );
    expect(() => sourceToHex('400 0% 100%')).toThrow();
  });

  it('normalises any -- keyed source without mutating it (a theme mobile block, A5)', () => {
    const source = Object.freeze({ '--background': '0 0% 0%', '--card-foreground': '0 0% 100%' });
    expect(normaliseColours(source)).toEqual({
      background: hexOf(BLACK),
      cardForeground: hexOf(WHITE),
    });
    expect(source).toEqual({ '--background': '0 0% 0%', '--card-foreground': '0 0% 100%' });
  });
});

describe('radii, spacing and shadows', () => {
  it('has the handoff radii 2, 3, 4, 6, 8, 10, 12, 14 by name, and full', () => {
    expect(STUDIO_RADII).toEqual({
      tag: 2,
      chip: 3,
      segment: 4,
      control: 6,
      card: 8,
      panel: 10,
      pill: 12,
      sheet: 14,
      full: 999,
    });
  });

  it('has spacing.css --space-1 … --space-10', () => {
    expect(Object.values(STUDIO_SPACING)).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 24, 28]);
  });

  it('draws the README hairline and toast shadows in the shadow ink (30 50% 18%)', () => {
    const ink = oracleHex('30 50% 18%');
    expect(STUDIO_SHADOWS.hairline).toEqual([
      { offsetX: 0, offsetY: 1, blurRadius: 0, color: `${ink}0D` },
    ]);
    expect(STUDIO_SHADOWS.toast).toEqual([
      { offsetX: 0, offsetY: 4, blurRadius: 14, color: `${ink}14` },
    ]);
    expect(STUDIO_SHADOWS.active).toHaveLength(2);
    for (const layers of Object.values(STUDIO_SHADOWS)) {
      for (const layer of layers) expect(layer.color).toMatch(HEX8);
    }
  });
});

describe('the typed accessor', () => {
  it('gives Studio Light and Dark, the same object each time', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = tokensFor('studio', scheme);
      expect(tokens).toBe(tokensFor('studio', scheme));
      expect(tokens.style).toBe('studio');
      expect(tokens.scheme).toBe(scheme);
      expect(tokens.colours).toBe(STUDIO_COLOURS[scheme]);
      expect(tokens.radii).toBe(STUDIO_RADII);
      expect(tokens.type).toBe(STUDIO_TYPE);
    }
    expect(tokensFor('studio', 'dark').colours.background).not.toBe(
      tokensFor('studio', 'light').colours.background,
    );
  });

  it('is frozen: a layout cannot change a token for every other screen', () => {
    const tokens = tokensFor('studio', 'light');
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(Object.isFrozen(tokens.colours)).toBe(true);
    expect(Object.isFrozen(tokens.shadows.toast)).toBe(true);
  });
});

describe('the type scale', () => {
  const roles = Object.keys(TYPE_SPECS) as TypeRole[];
  const sizesOf = (family: string, prefix: string) =>
    roles
      .filter((role) => role.startsWith(prefix) && TYPE_SPECS[role].family === family)
      .map((role) => TYPE_SPECS[role].size);

  it('has no size below 11 (D38)', () => {
    expect(MIN_TEXT_SIZE).toBe(11);
    for (const role of roles) {
      expect(STUDIO_TYPE[role].fontSize, role).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });

  it('has the handoff sizes: Newsreader titles, Geist body, Geist Mono figures', () => {
    expect(sizesOf('serif', 'title')).toEqual([28, 23, 21, 15, 14.5, 14]);
    expect(sizesOf('sans', 'body')).toEqual([14, 13.5, 13, 12.5, 12, 11.5]);
    expect(sizesOf('mono', 'figure')).toEqual([19, 17, 15]);
  });

  it('raises the 9-10.5 px mono labels to 11, uppercase and tracked', () => {
    for (const role of ['eyebrow', 'label'] as const) {
      expect(STUDIO_TYPE[role]).toMatchObject({
        fontFamily: 'GeistMono-SemiBold',
        fontSize: 11,
        textTransform: 'uppercase',
      });
    }
    expect(STUDIO_TYPE.label.letterSpacing).toBe(1.32); // 0.12em of 11 pt
  });

  it('sets every role on a bundled face by PostScript name', () => {
    const postscriptNames = new Set([...FONT_FACES.values()].map((face) => face.postscriptName));
    for (const role of roles)
      expect(postscriptNames.has(STUDIO_TYPE[role].fontFamily), role).toBe(true);
    expect(STUDIO_TYPE.title1).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-Medium',
      lineHeight: 29.4,
      letterSpacing: -0.56,
    });
    expect(STUDIO_TYPE.body1).toMatchObject({ fontFamily: 'Geist-Regular', lineHeight: 21.7 });
    expect(STUDIO_TYPE.figure1.fontVariant).toEqual(['tabular-nums']);
  });

  it('gives a role at another bundled weight or in italic, and refuses a face not bundled', () => {
    expect(typeStyle('body5', { weight: 500 }).fontFamily).toBe('Geist-Medium');
    const italic = typeStyle('title6', { weight: 400, italic: true });
    expect(italic.fontFamily).toBe('Newsreader16pt16pt-Italic');
    expect(italic).not.toHaveProperty('fontStyle');
    expect(STUDIO_TYPE.title6).not.toHaveProperty('fontWeight');
    expect(() => typeStyle('body1', { weight: 700 })).toThrow(/not bundled/);
  });

  it('keeps Dynamic Type on', () => {
    expect(TEXT_SCALING).toEqual({ allowFontScaling: true });
  });
});
