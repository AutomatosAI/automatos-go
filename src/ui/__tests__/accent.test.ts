// docs/app-standard.md rule 10.4, for what the app paints "in the accent" as a foreground: text,
// a glyph, a rule, a dot. In every built-in palette it reads on the page and on a card, in Studio
// it is still the accent itself, and in a palette whose `accent` is a ground (Candy's chip) it is
// the palette's strong ink. Each shared place that paints it is checked through its own function.

import { describe, expect, it } from 'vitest';

import { stripCellPaint } from '../../cc/calendar/chrome';
import { tabPaint } from '../../cc/shell/chrome';
import { spanStyle } from '../../chat/markdown/look';
import { contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { STYLE_IDS, tokensFor, type Colours, type Tokens } from '../../styles/tokens';
import { STUDIO_COLOURS } from '../../styles/tokens/studio';
import { MARK_CONTRAST, accentInk, accentToken } from '../accent';
import { toneColour } from '../tone-colour';
import { fieldPaint } from '../variants';

const SCHEMES = ['light', 'dark'] as const;
const PALETTES: readonly Tokens[] = [
  ...new Set(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => tokensFor(style, scheme)))),
];
const nameOf = (tokens: Tokens) => `${tokens.style} ${tokens.scheme}`;
const CANDY = tokensFor('candy', 'light');
const STUDIO = tokensFor('studio', 'light');

describe('the accent as a foreground', () => {
  it.each(PALETTES.map((tokens) => [nameOf(tokens), tokens] as const))(
    '%s: it reads as a mark on the page and on a card',
    (_name, tokens) => {
      const ink = accentInk(tokens.colours);
      expect(contrastRatio(ink, tokens.colours.background)).toBeGreaterThanOrEqual(MARK_CONTRAST);
      expect(contrastRatio(ink, tokens.colours.card)).toBeGreaterThanOrEqual(MARK_CONTRAST);
    },
  );

  it("is Studio's own accent, in both schemes", () => {
    expect(accentToken(STUDIO_COLOURS.light)).toBe('accent');
    expect(accentToken(STUDIO_COLOURS.dark)).toBe('accent');
    expect(accentInk(STUDIO.colours)).toBe(STUDIO.colours.accent);
  });

  it("is Candy's accent text colour, because its accent is its chip", () => {
    expect(CANDY.colours.accent).toBe(CANDY.colours.secondary);
    expect(contrastRatio(CANDY.colours.accent, CANDY.colours.background)).toBeLessThan(
      MARK_CONTRAST,
    );
    expect(accentToken(CANDY.colours)).toBe('primary');
    expect(accentInk(CANDY.colours)).toBe(CANDY.colours.primary);
  });

  it('follows the palette, not the style: any palette whose accent is a ground', () => {
    const quiet: Colours = { ...STUDIO_COLOURS.light, accent: STUDIO_COLOURS.light.background };
    expect(accentToken(quiet)).toBe('primary');
    const seeThrough: Colours = { ...STUDIO_COLOURS.light, accent: `${STUDIO.colours.accent}80` };
    expect(accentToken(seeThrough)).toBe('accent');
  });

  it('answers the same for the same palette object', () => {
    expect(accentToken(CANDY.colours)).toBe(accentToken(CANDY.colours));
  });
});

describe('each shared place that paints the accent reads it there', () => {
  const places = (colours: Colours) => ({
    accentTone: colours[toneColour(colours, 'accent')],
    invalidField: fieldPaint(colours, { invalid: true }).borderColor,
    link: spanStyle(STUDIO.type, colours, 'body1', [], true)?.color,
    selectedTabRule: tabPaint(colours, true).rule,
    dayWithItems: stripCellPaint(colours, { selected: false, today: false, hasItems: true }).dot,
  });

  it('in Candy, none of them is the chip', () => {
    const drawn = places(CANDY.colours);
    for (const [place, colour] of Object.entries(drawn)) {
      expect(colour, place).toBe(CANDY.colours.primary);
      expect(colour, place).not.toBe(CANDY.colours.accent);
    }
  });

  it('in Studio, all of them are the accent, as before', () => {
    for (const [place, colour] of Object.entries(places(STUDIO.colours))) {
      expect(colour, place).toBe(STUDIO.colours.accent);
    }
  });

  it('a field that is not invalid, an unselected tab and a chosen day are untouched', () => {
    expect(fieldPaint(CANDY.colours, {}).borderColor).toBe(CANDY.colours.border);
    expect(tabPaint(CANDY.colours, false).rule).toBe('transparent');
    const chosen = stripCellPaint(CANDY.colours, { selected: true, today: false, hasItems: true });
    expect(chosen.dot).toBe(CANDY.colours.card);
  });
});
