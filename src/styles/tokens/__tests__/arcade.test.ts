// Arcade's tokens against the design kit at 034fa629c: the catalogue copied as data, the
// palette's variables and sizes, the Studio-keyed set with exactly Studio's keys as #RRGGBB, every
// pair of design/contrast.json at or above its minimum on every palette (the vendored
// contrastRatio), the keys the kit leaves to Studio held to AA too, and the AI label readable.

import { describe, expect, it } from 'vitest';

import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { AI_LABEL_TONE } from '../../ai-label-state';
import {
  AGENT_COLOURS,
  ICON_COLOURS,
  ICON_KEYS,
  PALETTES,
  PALETTE_IDS,
  SCAN_ALPHA,
  SCAN_INK,
  SPRITE_COLOURS,
  SPRITE_KEYS,
  paletteById,
  type PaletteId,
} from '../arcade-catalogue';
import {
  ARCADE_DEFAULT_PICKS,
  ARCADE_PIXEL_SCALES,
  ARCADE_ROLES,
  ARCADE_SCANLINE_SHAPES,
  ARCADE_VAR_NAMES,
  ARCADE_WINDOW_FRAMES,
  ARCADE_WINDOW_STYLES,
  arcadePalette,
  arcadePixelScale,
  arcadeScanColour,
  arcadeTokens,
  arcadeTone,
  arcadeVars,
  arcadeWindowFrame,
  type ArcadePaintPicks,
} from '../arcade';
import { tokensFor } from '../index';
import { STYLE_RADII } from '../radii';
import { STUDIO_COLOURS, STUDIO_SHADOWS, STUDIO_SPACING, STUDIO_THREAD } from '../studio';
import { arcadeStyleTokens } from '../style-tokens';
import { threadPaint } from '../thread';
import type { ColourName, Colours } from '../types';

const HEX6 = /^#[0-9A-F]{6}$/;
const HEX6_OR_8 = /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/;
/** What React Native's normalize-colors reads: #RRGGBB, or rgba() with 0-255 channels. */
const RN_COLOUR = /^(?:#[0-9A-F]{6}|rgba\((?:\d{1,3},){3}(?:0|1|\d*\.\d+)\))$/i;
const COLOUR_KEYS = Object.keys(STUDIO_COLOURS.light).sort();

const picks = (palette: PaletteId): ArcadePaintPicks => ({ ...ARCADE_DEFAULT_PICKS, palette });
const LOOKS = PALETTE_IDS.map(picks);

/**
 * design/contrast.json at 034fa629c (sha256
 * 90d8be141035e20d11c3b39d7dd951c0a0457f9609cce4f994246d6085070528), copied: the design's
 * pairs, the build's and Studio's (src/looks/pairs.ts ALL_PAIRS), min 4.5 unless given.
 */
const CONTRAST_PAIRS: readonly { text: string; ground: string; min?: number }[] = [
  { text: '--arcade-tx', ground: '--arcade-win' },
  { text: '--arcade-tx2', ground: '--arcade-win' },
  { text: '--arcade-bar-tx', ground: '--arcade-bar' },
  { text: '--arcade-ac', ground: '--arcade-page' },
  { text: '--arcade-hp', ground: '--arcade-win' },
  { text: '--arcade-xp', ground: '--arcade-win' },
  { text: '--arcade-mp', ground: '--arcade-win' },
  { text: '--arcade-qs', ground: '--arcade-win' },
  { text: '--arcade-hlt', ground: '--arcade-hl' },
  { text: '--arcade-aci', ground: '--arcade-ac' },
  { text: '--arcade-bd', ground: '--arcade-page', min: 3 },
  { text: '--arcade-tx', ground: '--arcade-page' },
  { text: '--arcade-tx2', ground: '--arcade-page' },
  { text: '--arcade-ac', ground: '--arcade-win' },
  { text: '--arcade-bd', ground: '--arcade-win', min: 3 },
  { text: '--foreground', ground: '--background' },
  { text: '--card-foreground', ground: '--card' },
  { text: '--popover-foreground', ground: '--popover' },
  { text: '--primary-foreground', ground: '--primary' },
  { text: '--secondary-foreground', ground: '--secondary' },
  { text: '--muted-foreground', ground: '--background' },
  { text: '--muted-foreground', ground: '--card' },
  { text: '--muted-foreground', ground: '--muted' },
  { text: '--accent-foreground', ground: '--accent' },
  { text: '--destructive-foreground', ground: '--destructive' },
  { text: '--primary', ground: '--background' },
  { text: '--primary', ground: '--card' },
  { text: '--destructive', ground: '--background' },
  { text: '--destructive', ground: '--card' },
  { text: '--fg-3', ground: '--bg-1' },
  { text: '--fg-3', ground: '--paper' },
  { text: '--ring', ground: '--background', min: 3 },
];

/** The keys the kit leaves to Studio, as the phone sets text or a mark on them. */
const PHONE_PAIRS: readonly [ColourName, ColourName, number][] = [
  ['successForeground', 'success', AA_TEXT],
  ['warningForeground', 'warning', AA_TEXT],
  ['infoForeground', 'info', AA_TEXT],
  ['agentForeground', 'agent', AA_TEXT],
  ['onStrong', 'primary', AA_TEXT],
  ['warnInk', 'background', AA_TEXT],
  ['warnInk', 'card', AA_TEXT],
  ['navy', 'card', AA_TEXT],
  ['olive', 'card', AA_TEXT],
  ['agent', 'card', AA_TEXT],
  ['info', 'card', AA_TEXT],
  ['foreground', 'accent2', AA_TEXT],
  ['accent', 'accent2', AA_TEXT],
  ['running', 'card', AA_NON_TEXT],
  ['ccLiveDot', 'card', AA_NON_TEXT],
  ['chart1', 'card', AA_NON_TEXT],
  ['chart2', 'card', AA_NON_TEXT],
  ['chart3', 'card', AA_NON_TEXT],
  ['chart4', 'card', AA_NON_TEXT],
  ['chart5', 'card', AA_NON_TEXT],
];

const camel = (name: string) => name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

/** A contrast.json name's colour: '--arcade-bar-tx' → the variable barTx, '--fg-3' → fg3. */
function colourOf(name: string, look: ArcadePaintPicks): string {
  const vars = arcadeVars(look) as Readonly<Record<string, string>>;
  const studio = arcadeTokens(look) as Readonly<Record<string, string>>;
  const arcade = /^--arcade-(.+)$/.exec(name);
  const found = arcade ? vars[camel(arcade[1])] : studio[camel(name.slice(2))];
  if (found === undefined) throw new Error(`no colour for ${name}`);
  return found;
}

describe('arcade-catalogue (the kit at 034fa629c, copied as data)', () => {
  it('copies the five palettes in order, with their tone, scanlines and art', () => {
    const row = (p: (typeof PALETTES)[number]) => [p.id, p.name, p.tone, p.scanlines, p.art];
    expect(PALETTES.map(row)).toEqual([
      ['overworld', 'Overworld', 'dark', 'soft', 'bronze'],
      ['dungeon', 'Dungeon', 'dark', 'soft', 'bronze'],
      ['neon', 'Neon Cabinet', 'dark', 'strong', 'bronze'],
      ['nightcity', 'Night City', 'dark', 'soft', 'bronze'],
      ['handheld', 'Handheld', 'light', 'soft', 'shades'],
    ]);
    expect(PALETTES.map((p) => p.id)).toEqual([...PALETTE_IDS]);
    expect(Object.isFrozen(PALETTES)).toBe(true);
  });

  it("copies Overworld's and Handheld's colours exactly", () => {
    expect(paletteById('overworld')?.colours).toEqual({
      page: '#0D1710', win: '#15291B', bar: '#0A120C', barTx: '#EEE7D2', tx: '#EEE7D2',
      tx2: '#BCC7A9', bd: '#D9CFA8', ac: '#7FE35C', aci: '#0B1A07', hl: '#7FE35C',
      hlt: '#0B1A07', hp: '#FF6E61', xp: '#FFD24A', mp: '#74BDFF', qs: '#FFE34D',
      sh: 'rgba(0,0,0,.55)', bevl: 'rgba(255,255,255,.14)', bevd: 'rgba(0,0,0,.45)',
    });
    expect(paletteById('handheld')?.colours).toMatchObject({
      page: '#C9D4A3', win: '#DCE5B8', tx: '#1E2612', ac: '#1E2612', aci: '#DCE5B8',
      hp: '#8E1F14', sh: '#9AAA6A', bevd: 'rgba(30,38,18,.25)',
    });
    expect(paletteById('neon')?.map.t2).toBe('#FF52D9');
    expect(paletteById('arcade')).toBeUndefined();
  });

  it('gives every palette every interface and map colour, as React Native reads them', () => {
    for (const palette of PALETTES) {
      expect(Object.keys(palette.colours)).toHaveLength(18);
      expect(Object.keys(palette.map)).toHaveLength(13);
      Object.values(palette.colours).forEach((c) => expect(c, palette.id).toMatch(RN_COLOUR));
      Object.values(palette.map).forEach((c) => expect(c, palette.id).toMatch(HEX6));
    }
  });

  it('copies the sprite, icon and agent colours for both art sets', () => {
    for (const art of ['bronze', 'shades'] as const) {
      expect(Object.keys(SPRITE_COLOURS[art])).toEqual([...SPRITE_KEYS]);
      expect(Object.keys(ICON_COLOURS[art])).toEqual([...ICON_KEYS]);
      expect(AGENT_COLOURS[art]).toHaveLength(4);
      Object.values(SPRITE_COLOURS[art]).forEach((c) => expect(c).toMatch(HEX6_OR_8));
      Object.values(ICON_COLOURS[art]).forEach((c) => expect(c).toMatch(HEX6_OR_8));
      AGENT_COLOURS[art].flat().forEach((c) => expect(c).toMatch(HEX6));
    }
    expect(SPRITE_COLOURS.bronze).toMatchObject({ s: '#D86A2B', e: '#6EF5C4', g: '#00000059' });
    expect(SPRITE_COLOURS.shades).toMatchObject({ o: '#1E2612', g: '#1E261240' });
    expect(AGENT_COLOURS.bronze[0]).toEqual(['#4FA3E0', '#2A6A9E']);
  });

  it("copies the scanlines' ink and alphas", () => {
    expect(SCAN_INK).toEqual({ dark: '0,0,0', light: '30,38,18' });
    expect(SCAN_ALPHA).toEqual({
      dark: { off: 0, soft: 0.14, strong: 0.32 },
      light: { off: 0, soft: 0.14, strong: 0.14 },
    });
  });
});

describe("the palette's variables and sizes", () => {
  it.each(LOOKS)('names every variable for $palette, as React Native reads them', (look) => {
    const vars = arcadeVars(look);
    expect(Object.keys(vars).sort()).toEqual([...ARCADE_VAR_NAMES].sort());
    const { colours } = arcadePalette(look.palette);
    expect(vars).toMatchObject(colours);
    Object.values(vars).forEach((colour) => expect(colour).toMatch(RN_COLOUR));
    expect(Object.isFrozen(vars)).toBe(true);
  });

  it('keeps the bevels and the shadow as the catalogue writes them', () => {
    expect(arcadeVars(picks('neon'))).toMatchObject({
      sh: 'rgba(255,82,217,.28)',
      bevl: 'rgba(63,242,255,.18)',
      bevd: 'rgba(0,0,0,.6)',
    });
  });

  it("draws the scanlines in the tone's ink at the style's alpha, the ink at 0 when Off", () => {
    expect(arcadeScanColour({ palette: 'overworld', scanlines: 'soft' })).toBe('rgba(0,0,0,0.14)');
    expect(arcadeScanColour({ palette: 'neon', scanlines: 'strong' })).toBe('rgba(0,0,0,0.32)');
    expect(arcadeScanColour({ palette: 'handheld', scanlines: 'strong' })).toBe(
      'rgba(30,38,18,0.14)',
    );
    expect(arcadeScanColour({ palette: 'dungeon', scanlines: 'off' })).toBe('rgba(0,0,0,0)');
  });

  it("paints Handheld light and the other palettes dark, whatever the phone's scheme", () => {
    expect(PALETTE_IDS.map((palette) => arcadeTone({ palette }))).toEqual([
      'dark',
      'dark',
      'dark',
      'dark',
      'light',
    ]);
  });

  it("sizes the window, the scanlines and the pixels as the kit's prepaint does", () => {
    expect(ARCADE_WINDOW_STYLES).toEqual(['classic', 'thin']);
    expect(ARCADE_PIXEL_SCALES).toEqual(['2', '3']);
    expect(arcadeWindowFrame({ windowStyle: 'classic' })).toEqual({
      border: 2, bevel: 1, ring2: 4, ring3: 6, drop: 6, spread: 6,
    });
    expect(arcadeWindowFrame({ windowStyle: 'thin' })).toEqual({
      border: 2, bevel: 0, ring2: 2, ring3: 2, drop: 4, spread: 2,
    });
    expect(ARCADE_WINDOW_FRAMES.classic).toBe(arcadeWindowFrame({ windowStyle: 'classic' }));
    expect(ARCADE_SCANLINE_SHAPES).toEqual({
      off: { line: 0, period: 3 },
      soft: { line: 1, period: 3 },
      strong: { line: 2, period: 4 },
    });
    expect(arcadePixelScale({ pixelScale: '2' })).toBe(2);
    expect(arcadePixelScale({ pixelScale: '3' })).toBe(3);
  });

  it("starts from Overworld's preset", () => {
    expect(ARCADE_DEFAULT_PICKS).toEqual({
      palette: 'overworld',
      scanlines: 'soft',
      windowStyle: 'classic',
      pixelScale: '3',
    });
  });
});

describe('the Studio-keyed set', () => {
  it('gives every Studio key a role', () => {
    expect(Object.keys(ARCADE_ROLES).sort()).toEqual(COLOUR_KEYS);
  });

  it.each(LOOKS)('yields every Studio key as #RRGGBB for $palette', (look) => {
    const colours = arcadeTokens(look);
    expect(Object.keys(colours).sort()).toEqual(COLOUR_KEYS);
    Object.entries(colours).forEach(([name, colour]) => expect(colour, name).toMatch(HEX6));
    expect(Object.isFrozen(colours)).toBe(true);
  });

  it("follows the kit's studioVars for the keys it sets", () => {
    for (const look of LOOKS) {
      const { colours: c, tone } = arcadePalette(look.palette);
      expect(arcadeTokens(look)).toMatchObject({
        background: c.page, foreground: c.tx, card: c.win, cardForeground: c.tx,
        popover: c.win, popoverForeground: c.tx, secondary: c.win, secondaryForeground: c.tx,
        muted: c.win, mutedForeground: c.tx2, primary: c.ac, primaryForeground: c.aci,
        ring: c.ac, accent: c.hl, accentForeground: c.hlt, destructive: c.hp,
        destructiveForeground: tone === 'dark' ? c.page : c.win, border: c.bd, input: c.bd,
        ccHover: c.win, ccHoverBorder: c.bd, paper: c.win, bg1: c.page, bg2: c.win,
        fg: c.tx, fg2: c.tx2, fg3: c.tx2, border2: c.tx2,
      } satisfies Partial<Colours>);
    }
  });
});

describe("Arcade's whole token set", () => {
  it.each(LOOKS)('is square, in the palette tone, for $palette', (look) => {
    const tokens = arcadeStyleTokens(look);
    expect(tokens.style).toBe('arcade');
    expect(tokens.scheme).toBe(look.palette === 'handheld' ? 'light' : 'dark');
    expect(tokens.colours).toEqual(arcadeTokens(look));
    expect(tokens.radii).toBe(STYLE_RADII.arcade);
    expect(Object.values(tokens.radii).every((radius) => radius === 0)).toBe(true);
    expect(tokens.spacing).toBe(STUDIO_SPACING);
    expect(tokens.shadows).toBe(STUDIO_SHADOWS);
    expect(tokens.thread).toEqual(threadPaint(tokens.colours, STUDIO_THREAD[tokens.scheme].sail));
    expect(Object.isFrozen(tokens)).toBe(true);
  });

  it('builds one set per look object', () => {
    const look = picks('dungeon');
    expect(arcadeStyleTokens(look)).toBe(arcadeStyleTokens(look));
    expect(arcadeStyleTokens({ ...look })).not.toBe(arcadeStyleTokens(look));
    expect(arcadeStyleTokens({ ...look })).toEqual(arcadeStyleTokens(look));
  });

  it("is Overworld through the accessor, in both of the phone's schemes", () => {
    expect(tokensFor('arcade', 'light')).toBe(arcadeStyleTokens(ARCADE_DEFAULT_PICKS));
    expect(tokensFor('arcade', 'dark')).toBe(tokensFor('arcade', 'light'));
    expect(tokensFor('arcade', 'light').scheme).toBe('dark');
  });
});

describe('contrast on every palette (the vendored contrastRatio)', () => {
  it('copies all 32 pairs of design/contrast.json', () => {
    expect(CONTRAST_PAIRS).toHaveLength(32);
  });

  it.each(LOOKS)("holds every contrast.json pair at its minimum on $palette", (look) => {
    for (const pair of CONTRAST_PAIRS) {
      const ratio = contrastRatio(colourOf(pair.text, look), colourOf(pair.ground, look));
      expect(ratio, `${pair.text} on ${pair.ground}`).toBeGreaterThanOrEqual(pair.min ?? AA_TEXT);
    }
  });

  it.each(LOOKS)('holds the keys the kit leaves to Studio at AA on $palette', (look) => {
    const colours = arcadeTokens(look);
    for (const [text, ground, min] of PHONE_PAIRS) {
      const ratio = contrastRatio(colours[text], colours[ground]);
      expect(ratio, `${text} on ${ground}`).toBeGreaterThanOrEqual(min);
    }
  });

  it.each(LOOKS)("reads the AI label's muted text at AA on its ground on $palette", (look) => {
    const { colours } = arcadeStyleTokens(look);
    expect(contrastRatio(colours[AI_LABEL_TONE], colours.background)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});
