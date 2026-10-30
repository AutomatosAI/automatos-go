// Candy's tokens against the design kit at 3920359d5: the catalogue copied as data, the palette's
// variables with the card stops in the palette's order, the Studio-keyed set with exactly Studio's
// keys as #RRGGBB and the kit's prepaint triplets, every pair of design/contrast.json at or above
// its minimum on every preset with Mixed and One colour cards (the vendored contrastRatio), the
// mobile skins' ten pairs, the keys the kit leaves to Studio held too, and the AI label readable.
//
// design/contrast.json: AutomatosAI/automatos-design-kit themes/candy/design/contrast.json at
// 3920359d5 (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 80b54d02854558a6c432031a677354f403af7b69f36c9508c54a210254a68df7, its 51 pairs copied below.

import { describe, expect, it } from 'vitest';

import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { tripletToHex } from '../../../core/web/lib/look-kit/hsl';
import { AI_LABEL_TONE } from '../../ai-label-state';
import {
  CANDY_DEFAULT_PICKS,
  CANDY_ROLES,
  CANDY_VAR_NAMES,
  candyCardOrder,
  candyPalette,
  candyTokens,
  candyTone,
  candyVars,
  type CandyPaintPicks,
} from '../candy';
import {
  AUTO_COLOURS,
  CARD_INK,
  CARD_SETS,
  DANGER,
  KIND_SETS,
  LAYER_COLOURS,
  PALETTES,
  PALETTE_IDS,
  SHARED_COLOURS,
  paletteById,
  type PaletteId,
} from '../candy-catalogue';
import { STUDIO_COLOURS, STUDIO_THREAD } from '../studio';
import { candyStyleTokens } from '../style-tokens';
import { threadPaint } from '../thread';
import type { ColourName, Colours } from '../types';
import { PREPAINT_CARDS, PREPAINT_STUDIO } from './candy-prepaint';

const HEX6 = /^#[0-9A-F]{6}$/;
/** What React Native's normalize-colors reads: #RRGGBB, or rgba() with 0-255 channels. */
const RN_COLOUR = /^(?:#[0-9A-F]{6}|rgba\((?:\d{1,3},){3}(?:0|1|\d*\.\d+)\))$/i;
const COLOUR_KEYS = Object.keys(STUDIO_COLOURS.light).sort();

/** spec.ts's three presets (its PRESET_KNOBS), each with Mixed and One colour cards. */
const PRESETS: readonly CandyPaintPicks[] = [
  CANDY_DEFAULT_PICKS,
  { palette: 'lilac', cards: 'mix', gradient: 'vivid', roundness: '32', glow: 5 },
  { palette: 'nightbloom', cards: 'mix', gradient: 'vivid', roundness: '28', glow: 8 },
];
const LOOKS = PRESETS.flatMap((look) => [look, { ...look, cards: 'single' as const }]);
const picks = (palette: PaletteId): CandyPaintPicks => ({ ...CANDY_DEFAULT_PICKS, palette });

/** design/contrast.json's pairs: [text, ground, min] (4.5 unless given). */
const CONTRAST_PAIRS: readonly (readonly [string, string, number?])[] = [
  ['--candy-text', '--candy-page'],
  ['--candy-text', '--candy-win'],
  ['--candy-text', '--candy-chip'],
  ['--candy-text', '--candy-band-a'],
  ['--candy-quiet', '--candy-win'],
  ['--candy-quiet', '--candy-page'],
  ['--candy-accent-ink', '--candy-accent'],
  ['--candy-accent', '--candy-win', 3],
  ['--candy-accent', '--candy-page', 3],
  ['--candy-card-ink', '--candy-g1a'],
  ['--candy-card-ink', '--candy-g2a'],
  ['--candy-card-ink', '--candy-g3a'],
  ['--candy-text', '--candy-band-b'],
  ['--candy-text', '--candy-band-1'],
  ['--candy-text', '--candy-band-2'],
  ['--candy-text', '--candy-band-3'],
  ['--candy-quiet', '--candy-chip'],
  ['--candy-band-quiet', '--candy-band-a'],
  ['--candy-band-quiet', '--candy-band-b'],
  ['--candy-band-quiet', '--candy-band-1'],
  ['--candy-band-quiet', '--candy-band-2'],
  ['--candy-band-quiet', '--candy-band-3'],
  ['--candy-accent-text', '--candy-page'],
  ['--candy-accent-text', '--candy-win'],
  ['--candy-accent-text', '--candy-chip'],
  ['--candy-user-ink', '--candy-user-a'],
  ['--candy-user-ink', '--candy-user-b'],
  ['--candy-stage-ink', '--candy-card-ink'],
  ['--candy-card-ink', '--candy-g1b'],
  ['--candy-card-ink', '--candy-g2b'],
  ['--candy-card-ink', '--candy-g3b'],
  ['--candy-card-ink', '--candy-g1c', 3],
  ['--candy-card-ink', '--candy-g2c', 3],
  ['--candy-card-ink', '--candy-g3c', 3],
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--muted'],
  ['--accent-foreground', '--accent'],
  ['--destructive-foreground', '--destructive'],
  ['--primary', '--background'],
  ['--primary', '--card'],
  ['--destructive', '--background'],
  ['--destructive', '--card'],
  ['--fg-3', '--bg-1'],
  ['--fg-3', '--paper'],
  ['--ring', '--background', 3],
];

/** The kit's guides/mobile-skins.md 'Contrast': what a phone skin must hold. */
const MOBILE_PAIRS: readonly [ColourName, ColourName, number][] = [
  ['foreground', 'background', AA_TEXT],
  ['cardForeground', 'card', AA_TEXT],
  ['popoverForeground', 'popover', AA_TEXT],
  ['secondaryForeground', 'secondary', AA_TEXT],
  ['mutedForeground', 'muted', AA_TEXT],
  ['primaryForeground', 'primary', AA_TEXT],
  ['accentForeground', 'accent', AA_TEXT],
  ['destructiveForeground', 'destructive', AA_TEXT],
  ['primary', 'background', AA_NON_TEXT],
  ['ring', 'background', AA_NON_TEXT],
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
  ['warnInk', 'secondary', AA_TEXT],
  ['navy', 'card', AA_TEXT],
  ['olive', 'card', AA_TEXT],
  ['agent', 'card', AA_TEXT],
  ['info', 'card', AA_TEXT],
  ['info', 'secondary', AA_TEXT],
  ['foreground', 'accent2', AA_TEXT],
  ['primary', 'accent2', AA_TEXT],
  ['warning', 'card', AA_NON_TEXT],
  ['running', 'card', AA_NON_TEXT],
  ['ccLiveDot', 'card', AA_NON_TEXT],
  ['chart1', 'card', AA_NON_TEXT],
  ['chart2', 'card', AA_NON_TEXT],
  ['chart3', 'card', AA_NON_TEXT],
  ['chart4', 'card', AA_NON_TEXT],
  ['chart5', 'card', AA_NON_TEXT],
];

const camel = (name: string) => name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

/** A contrast.json name's colour: '--candy-band-a' → the variable bandA, '--fg-3' → fg3. */
function colourOf(name: string, look: CandyPaintPicks): string {
  const vars = candyVars(look) as Readonly<Record<string, string>>;
  const studio = candyTokens(look) as Readonly<Record<string, string>>;
  const candy = /^--candy-(.+)$/.exec(name);
  const found = candy ? vars[camel(candy[1])] : studio[camel(name.slice(2))];
  if (found === undefined) throw new Error(`no colour for ${name}`);
  return found;
}

describe('candy-catalogue (the kit at 3920359d5, copied as data)', () => {
  it('copies the three palettes in order, with their name, line, tone and card order', () => {
    const row = (p: (typeof PALETTES)[number]) => [p.id, p.name, p.sub, p.tone, p.order];
    expect(PALETTES.map(row)).toEqual([
      ['blush', 'Blush', 'Pink on white, mixed cards', 'light', ['pink', 'violet', 'blue']],
      ['lilac', 'Lilac', 'Violet into blue, airy', 'light', ['violet', 'blue', 'pink']],
      ['nightbloom', 'Night bloom', 'Neon pinks after dark', 'dark', ['pink', 'violet', 'blue']],
    ]);
    expect(PALETTES.map((p) => p.id)).toEqual([...PALETTE_IDS]);
    expect(Object.isFrozen(PALETTES)).toBe(true);
  });

  it("copies the card sets with the kit's AA start stops, not the handoff's", () => {
    expect(CARD_SETS).toEqual({
      pink: { id: 'pink', a: '#D73178', b: '#B01E5F', c: '#9C3BD0' },
      violet: { id: 'violet', a: '#8E4AE8', b: '#5B2BCB', c: '#3557D8' },
      blue: { id: 'blue', a: '#2675D3', b: '#0F5DAE', c: '#0B8FB0' },
    });
    expect(CARD_INK).toBe('#FFFFFF');
  });

  it("copies Blush's and Night bloom's colours exactly", () => {
    expect(paletteById('blush')?.colours).toEqual({
      page: '#FBF0F4', bandA: '#FFD9E8', bandB: '#FFC2DA', band1: '#FFC6E0', band2: '#F2C9FF',
      band3: '#FFD9C2', win: '#FFFFFF', chip: '#FCE8F1', text: '#2A1830', quiet: '#6E5670',
      line: 'rgba(42,24,48,.09)', border: '#ECEAEC', bandQuiet: '#634B65', accent: '#D62F7A',
      accentInk: '#FFFFFF', accentText: '#C2266C', userA: '#D73178', userB: '#B01E5F',
      userInk: '#FFFFFF', stageInk: '#4A1E8E', tint: '214,47,122',
      blobs: ['#F9C6E4', '#FFE0C7', '#E5D4FF'],
    });
    expect(paletteById('nightbloom')?.colours).toMatchObject({
      page: '#150B1F', win: '#22142F', text: '#FBEFFA', accent: '#FF6FB5', accentInk: '#2A0618',
      line: 'rgba(255,255,255,.1)', tint: '255,80,170', blobs: ['#5A1856', '#1E2B66', '#3E1460'],
    });
    expect(paletteById('candy')).toBeUndefined();
  });

  it('gives every palette every colour, as React Native reads them', () => {
    for (const palette of PALETTES) {
      const { tint, blobs, ...colours } = palette.colours;
      expect(Object.keys(colours)).toHaveLength(20);
      Object.values(colours).forEach((c) => expect(c, palette.id).toMatch(RN_COLOUR));
      blobs.forEach((c) => expect(c, palette.id).toMatch(HEX6));
      expect(tint).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/);
    }
  });

  it("copies the red, the layers, the shared whites, Auto's colours and the kinds' cards", () => {
    expect(DANGER).toEqual({
      light: { fill: '#C02436', ink: '#FFFFFF' },
      dark: { fill: '#FF7A88', ink: '#2A0618' },
    });
    expect(LAYER_COLOURS).toEqual({
      highlight: 'rgba(255,255,255,.34)',
      highlightVivid: 'rgba(255,255,255,.5)',
      glowPink: 'rgba(255,170,210,.4)',
      glowCyan: 'rgba(90,230,255,.35)',
    });
    expect(Object.keys(SHARED_COLOURS)).toHaveLength(10);
    expect(SHARED_COLOURS).toMatchObject({ orbPink: '#FF9BC8', white92: 'rgba(255,255,255,.92)' });
    Object.values(SHARED_COLOURS).forEach((c) => expect(c).toMatch(RN_COLOUR));
    expect(Object.keys(AUTO_COLOURS)).toHaveLength(15);
    Object.values(AUTO_COLOURS).forEach((c) => expect(c).toMatch(HEX6));
    expect(AUTO_COLOURS).toMatchObject({ bodyA: '#FFA9CE', visorB: '#24102F', ballGlow: '#FF78BE' });
    expect(KIND_SETS).toEqual({
      report: 1, slides: 1, slide: 1, document: 2, spreadsheet: 2, image: 3, blog: 3, blog_post: 3,
    });
  });
});

describe("the palette's variables", () => {
  it.each(LOOKS)('names every variable for $palette with $cards cards', (look) => {
    const vars = candyVars(look);
    expect(Object.keys(vars).sort()).toEqual([...CANDY_VAR_NAMES].sort());
    const { tint: _tint, blobs: _blobs, ...colours } = candyPalette(look.palette).colours;
    expect(vars).toMatchObject({ ...colours, cardInk: CARD_INK });
    Object.values(vars).forEach((colour) => expect(colour).toMatch(RN_COLOUR));
    expect(Object.isFrozen(vars)).toBe(true);
  });

  it.each(LOOKS)("paints the card stops as prepaint.json's pairs table does: $palette, $cards", (look) => {
    const vars = candyVars(look);
    const stops = ['g1a', 'g1b', 'g1c', 'g2a', 'g2b', 'g2c', 'g3a', 'g3b', 'g3c'] as const;
    expect(stops.map((name) => vars[name])).toEqual(PREPAINT_CARDS[look.palette][look.cards]);
  });

  it("orders the cards by the palette, or its first set three times with One colour", () => {
    expect(candyCardOrder({ palette: 'lilac', cards: 'mix' })).toEqual(['violet', 'blue', 'pink']);
    expect(candyCardOrder({ palette: 'lilac', cards: 'single' })).toEqual([
      'violet',
      'violet',
      'violet',
    ]);
  });

  it("paints Blush and Lilac light and Night bloom dark, whatever the phone's scheme", () => {
    expect(PALETTE_IDS.map((palette) => candyTone({ palette }))).toEqual(['light', 'light', 'dark']);
  });

  it("starts from Blush's preset", () => {
    expect(CANDY_DEFAULT_PICKS).toEqual({
      palette: 'blush',
      cards: 'mix',
      gradient: 'rich',
      roundness: '28',
      glow: 6,
    });
  });
});

describe('the Studio-keyed set', () => {
  it('gives every Studio key a role', () => {
    expect(Object.keys(CANDY_ROLES).sort()).toEqual(COLOUR_KEYS);
  });

  it.each(PALETTE_IDS)('yields every Studio key as #RRGGBB for %s', (palette) => {
    const colours = candyTokens({ palette });
    expect(Object.keys(colours).sort()).toEqual(COLOUR_KEYS);
    Object.entries(colours).forEach(([name, colour]) => expect(colour, name).toMatch(HEX6));
    expect(Object.isFrozen(colours)).toBe(true);
  });

  it.each(PALETTE_IDS)("paints every key prepaint.json paints as a triplet alike, for %s", (palette) => {
    const colours = candyTokens({ palette }) as Readonly<Record<string, string>>;
    const others: string[] = [];
    for (const [name, value] of Object.entries(PREPAINT_STUDIO[palette])) {
      const triplet = /^hsl\((.+)\)$/.exec(value)?.[1] ?? value;
      const key = camel(name.slice(2));
      if (key in colours) expect(colours[key], name).toBe(tripletToHex(triplet));
      else others.push(key);
    }
    // the web's three keys the phone has no token for: the page and the border, as background and border
    expect(others).toEqual(['backgroundGradientFrom', 'backgroundGradientTo', 'glassBorderHover']);
    const web = PREPAINT_STUDIO[palette];
    expect(tripletToHex(web['--background-gradient-from'])).toBe(colours.background);
    expect(tripletToHex(web['--glass-border-hover'])).toBe(colours.border);
  });

  it("follows the kit's studioVars for the keys it sets", () => {
    for (const palette of PALETTE_IDS) {
      const { colours: c, tone } = candyPalette(palette);
      expect(candyTokens({ palette })).toMatchObject({
        background: c.page, foreground: c.text, card: c.win, cardForeground: c.text,
        popover: c.win, popoverForeground: c.text, secondary: c.chip, secondaryForeground: c.text,
        muted: c.chip, mutedForeground: c.quiet, primary: c.accentText,
        primaryForeground: c.accentInk, ring: c.accentText, accent: c.chip, accentForeground: c.text,
        destructive: DANGER[tone].fill, destructiveForeground: DANGER[tone].ink, border: c.border,
        input: c.border, ccHover: c.chip, ccHoverBorder: c.border, paper: c.win, bg1: c.page,
        bg2: c.win, fg: c.text, fg2: c.quiet, fg3: c.quiet, border2: c.quiet,
      } satisfies Partial<Colours>);
    }
  });
});

describe("Candy's whole token set", () => {
  it.each(PRESETS)("is in the palette's tone with its Roundness's corners, for $palette", (look) => {
    const tokens = candyStyleTokens(look);
    expect(tokens.style).toBe('candy');
    expect(tokens.scheme).toBe(look.palette === 'nightbloom' ? 'dark' : 'light');
    expect(tokens.colours).toEqual(candyTokens(look));
    expect(tokens.radii.card).toBe(Math.round(Number(look.roundness) * 0.72));
    expect(tokens.thread).toEqual(threadPaint(tokens.colours, STUDIO_THREAD[tokens.scheme].sail));
    expect(Object.isFrozen(tokens)).toBe(true);
  });

  it('builds one set per look object', () => {
    const look = picks('lilac');
    expect(candyStyleTokens(look)).toBe(candyStyleTokens(look));
    expect(candyStyleTokens({ ...look })).not.toBe(candyStyleTokens(look));
    expect(candyStyleTokens({ ...look })).toEqual(candyStyleTokens(look));
  });
});

describe('contrast on every preset (the vendored contrastRatio)', () => {
  it('copies all 51 pairs of design/contrast.json', () => {
    expect(CONTRAST_PAIRS).toHaveLength(51);
  });

  it.each(LOOKS)('holds every contrast.json pair at its minimum on $palette, $cards cards', (look) => {
    for (const [text, ground, min] of CONTRAST_PAIRS) {
      const ratio = contrastRatio(colourOf(text, look), colourOf(ground, look));
      expect(ratio, `${text} on ${ground}`).toBeGreaterThanOrEqual(min ?? AA_TEXT);
    }
  });

  it.each(PRESETS)("holds the mobile skins' ten pairs on $palette", (look) => {
    const colours = candyTokens(look);
    for (const [text, ground, min] of MOBILE_PAIRS) {
      const ratio = contrastRatio(colours[text], colours[ground]);
      expect(ratio, `${text} on ${ground}`).toBeGreaterThanOrEqual(min);
    }
  });

  it.each(PRESETS)('holds the keys the kit leaves to Studio on $palette', (look) => {
    const colours = candyTokens(look);
    for (const [text, ground, min] of PHONE_PAIRS) {
      const ratio = contrastRatio(colours[text], colours[ground]);
      expect(ratio, `${text} on ${ground}`).toBeGreaterThanOrEqual(min);
    }
  });

  it.each(PRESETS)("reads the AI label's muted text at AA on its ground on $palette", (look) => {
    const { colours } = candyStyleTokens(look);
    expect(contrastRatio(colours[AI_LABEL_TONE], colours.background)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});
