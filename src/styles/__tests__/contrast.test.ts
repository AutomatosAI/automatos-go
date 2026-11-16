// docs/app-standard.md rule 10.4, the one test over every pair: each text colour on each ground
// the primitives draw it on, in every palette of every built-in style, at WCAG AA (4.5:1). A new
// style is covered because STYLE_IDS grows; an app built from this template names its palettes,
// its pairs (TEXT_ON) and its KNOWN list in its settings (src/release/__tests__/settings/
// contrast.ts). KNOWN is the list of pairs that read under AA today, each with what it measures and
// why it stands: a pair that gets worse, a new one, and one that was fixed but is still listed all
// fail.

import { describe, expect, it } from 'vitest';

import { CONTRAST_PALETTES, KNOWN, TEXT_ON } from '../../release/__tests__/settings/contrast';
import { toneColour } from '../../ui/tone-colour';
import { TEXT_TONES, type TextTone } from '../../ui/variants';
import { AA_TEXT, contrastFailures, solidOver, textOnFor } from '../contrast';
import { STYLE_IDS, tokensFor, type ColourName, type Colours, type Tokens } from '../tokens';
import { STUDIO_COLOURS } from '../tokens/studio';

const DECIMALS = 100;
const floor2 = (ratio: number) => Math.floor(ratio * DECIMALS) / DECIMALS;

const PALETTES = CONTRAST_PALETTES;
const nameOf = (tokens: Tokens) => `${tokens.style} ${tokens.scheme}`;

const found = PALETTES.flatMap((tokens) =>
  contrastFailures(tokens.colours, textOnFor(tokens.colours, TEXT_ON)).map((failure) => ({
    pair: `${nameOf(tokens)}: ${failure.text} on ${failure.ground}`,
    ratio: floor2(failure.ratio),
  })),
);

describe('every text colour on every ground, in every palette (rule 10.4)', () => {
  it("covers each built-in style, and both of Studio's schemes", () => {
    expect(PALETTES.map(nameOf).sort()).toEqual(
      expect.arrayContaining(['studio dark', 'studio light']),
    );
    expect(new Set(PALETTES.map((tokens) => tokens.style))).toEqual(new Set(STYLE_IDS));
  });

  it('reads at AA, but for the pairs listed as known', () => {
    expect(found.map((each) => each.pair).sort()).toEqual(KNOWN.map((each) => each.pair).sort());
  });

  it.each(KNOWN)('$pair is no worse than when it was listed ($ratio:1)', ({ pair, ratio, why }) => {
    const now = found.find((each) => each.pair === pair);
    expect(now?.ratio, why).toBeGreaterThanOrEqual(ratio);
    expect(why).not.toBe('');
  });

  it('every pair names a colour of the shape, and no pair is listed twice', () => {
    const names = new Set(Object.keys(STUDIO_COLOURS.light));
    for (const [text, grounds] of TEXT_ON) {
      expect(names.has(text), text).toBe(true);
      for (const ground of grounds) expect(names.has(ground), ground).toBe(true);
    }
    expect(new Set(TEXT_ON.map(([text]) => text)).size).toBe(TEXT_ON.length);
  });

  it('measures every tone the Text primitive can paint', () => {
    const measured = new Set<ColourName>(TEXT_ON.map(([text]) => text));
    for (const tone of Object.keys(TEXT_TONES) as TextTone[]) {
      expect(measured.has(TEXT_TONES[tone]), tone).toBe(true);
    }
  });

  it("measures a state's words and the two quieter inks on the page and on a card (rule 2.1)", () => {
    const grounds = new Map(TEXT_ON.map(([text, on]) => [text, on]));
    const tones: readonly TextTone[] = ['success', 'info', 'warning', 'danger', 'muted', 'subtle'];
    for (const tone of tones) {
      expect(grounds.get(TEXT_TONES[tone]), tone).toEqual(
        expect.arrayContaining(['background', 'card']),
      );
    }
    expect(TEXT_TONES.danger).toBe('destructive');
    expect(TEXT_TONES.subtle).toBe('fg3');
  });
});

describe('a tone a palette reads from another token', () => {
  const candy = tokensFor('candy', 'light').colours;
  const studio = tokensFor('studio', 'light').colours;

  it("Candy's accent text is its accent's text colour, never its chip", () => {
    expect(toneColour(candy, 'accent')).toBe('primary');
    expect(toneColour(studio, 'accent')).toBe('accent');
    expect(toneColour(candy, 'muted')).toBe(TEXT_TONES.muted);
    expect(contrastFailures(candy, [['accent', ['background', 'card']]])).toHaveLength(2);
    expect(contrastFailures(candy, [['primary', ['background', 'card']]])).toEqual([]);
  });

  it('the pairs for a palette measure the token it draws', () => {
    const drawn = textOnFor(candy, TEXT_ON).map(([text]) => text);
    expect(drawn).toContain('primary');
    expect(drawn).not.toContain('accent');
    expect(textOnFor(studio, TEXT_ON)).toEqual(TEXT_ON);
  });
});

describe('contrastFailures', () => {
  const WHITE = STUDIO_COLOURS.light.card;
  const INK = STUDIO_COLOURS.light.foreground;
  const palette = (over: Partial<Colours>): Colours => ({ ...STUDIO_COLOURS.light, ...over });

  it('is empty for a pair at or over the least ratio, and names one under it', () => {
    expect(contrastFailures(palette({}), [['foreground', ['card']]])).toEqual([]);
    const same = contrastFailures(palette({ foreground: WHITE }), [['foreground', ['card']]]);
    expect(same).toEqual([{ text: 'foreground', ground: 'card', ratio: 1 }]);
  });

  it('takes its own least ratio', () => {
    const pairs = [['fg3', ['background']]] as const;
    expect(contrastFailures(palette({}), pairs, AA_TEXT)).toHaveLength(1);
    expect(contrastFailures(palette({}), pairs, 3)).toEqual([]);
  });

  it('blends a text colour that carries transparency over its ground first (rule 10.5)', () => {
    const clear = `${INK}00`;
    const solid = `${INK}FF`;
    expect(solidOver(clear, WHITE)).toBe(WHITE);
    expect(solidOver(solid, WHITE)).toBe(INK);
    expect(solidOver(INK, WHITE)).toBe(INK);
    expect(
      contrastFailures(palette({ foreground: clear }), [['foreground', ['card']]]),
    ).toHaveLength(1);
    expect(contrastFailures(palette({ foreground: solid }), [['foreground', ['card']]])).toEqual(
      [],
    );
  });

  it('measures a ground that carries transparency as it sits on the page', () => {
    const pairs = [['foreground', ['card']]] as const;
    const inkCard = `${INK}FF`;
    const noCard = `${INK}00`;
    expect(contrastFailures(palette({ card: inkCard }), pairs)).toEqual([
      { text: 'foreground', ground: 'card', ratio: 1 },
    ]);
    expect(contrastFailures(palette({ card: noCard }), pairs)).toEqual([]);
  });

  it('refuses to blend over a ground that is not solid, and a page that is not', () => {
    const veil = `${WHITE}80`;
    expect(() => solidOver(`${INK}80`, veil)).toThrow(/carries transparency/);
    expect(() => contrastFailures(palette({ background: veil }), TEXT_ON)).toThrow(
      /page is opaque/,
    );
  });
});
