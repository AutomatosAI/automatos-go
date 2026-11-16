// docs/app-standard.md rule 10.4, the one test over every pair: each text colour on each ground
// the primitives draw it on, in every palette of every built-in style, at WCAG AA (4.5:1). A new
// style is covered because STYLE_IDS grows; an app built from this template names its palettes,
// its pairs (TEXT_ON) and its KNOWN list in its settings (src/release/__tests__/settings/
// contrast.ts). KNOWN is the list of pairs that read under AA today, each with what it measures and
// why it stands: a pair that gets worse, a new one, and one that was fixed but is still listed all
// fail. The switch's marks (its thumb on each track, each track on the page and on a card) are held
// at 3 to 1 in every palette too, with no known list, and a filter pill's count, idle and selected,
// at AA on the ground its pill shows in every style's dress, every look of each; and the switches
// Candy and HUD draw themselves, in every look of each.

import { describe, expect, it } from 'vitest';

import { contrastRatio, mixHex } from '../../core/web/lib/look-kit/contrast';
import { rgba } from '../../core/web/lib/look-kit/css';
import { CONTRAST_PALETTES, KNOWN, TEXT_ON } from '../../release/__tests__/settings/contrast';
import { MARK_CONTRAST } from '../../ui/accent';
import { pillCount } from '../../ui/pill-count';
import { switchTokens } from '../../ui/switch-model';
import { toneColour } from '../../ui/tone-colour';
import { TEXT_TONES, type TextTone } from '../../ui/variants';
import { AA_TEXT, contrastFailures, solidOver, textOnFor, type TextOnGrounds } from '../contrast';
import { STYLE_IDS, tokensFor, type ColourName, type Colours, type Tokens } from '../tokens';
import { STUDIO_COLOURS } from '../tokens/studio';
import { dressOf } from '../dress/dress';
import { ALL_STYLES, CANDY_STYLES, HUD_STYLES } from '../dress/__tests__/fixtures';
import { motionSwitchPaint } from '../candy/look-page/knobs';

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

describe("the switch's marks, in every palette (rule 10.4: 3 to 1)", () => {
  const SWITCH_GROUNDS: readonly ColourName[] = ['background', 'card'];
  const marks = PALETTES.flatMap((tokens) => {
    const { onTrack, thumb, offTrack } = switchTokens(tokens.colours);
    const pairs: readonly TextOnGrounds[] = [
      [thumb, [onTrack, offTrack]],
      [onTrack, SWITCH_GROUNDS],
      [offTrack, SWITCH_GROUNDS],
    ];
    return contrastFailures(tokens.colours, pairs, MARK_CONTRAST).map(
      (failure) =>
        `${nameOf(tokens)}: ${failure.text} on ${failure.ground} ${floor2(failure.ratio)}`,
    );
  });

  it('the thumb on each track, and each track on the page and on a card', () => {
    expect(marks).toEqual([]);
  });
});

describe("a filter pill's count, in every style's dress (rule 10.5: AA)", () => {
  const counts = ALL_STYLES.flatMap((style, index) => {
    const dress = dressOf(style);
    const page = style.tokens.colours.background;
    const states = [
      ['idle', { selected: false }],
      ['pressed', { selected: false, pressed: true }],
      ['selected', { selected: true }],
    ] as const;
    return states.flatMap(([state, pill]) => {
      const { colour, ground } = pillCount(dress, pill, page);
      const ratio = contrastRatio(colour, ground);
      const name = `${style.tokens.style} ${style.tokens.scheme} #${index}`;
      return ratio >= AA_TEXT ? [] : [`${name} ${state} ${floor2(ratio)}`];
    });
  });

  it('idle, pressed and selected, each on the ground its pill shows', () => {
    expect(counts).toEqual([]);
  });
});

describe('the switches the styles draw themselves, in every look of each', () => {
  it("Candy's Motion: the thumb on each track, each track on the page and a window (3 to 1)", () => {
    const bad = CANDY_STYLES.flatMap((style, index) => {
      const vars = style.candy;
      if (!vars) return [`#${index}: no Candy paint`];
      const paint = motionSwitchPaint(vars);
      const grounds = [paint.thumbColor, vars.page, vars.win];
      return [paint.trackColor.true, paint.trackColor.false].flatMap((track) =>
        grounds
          .filter((ground) => contrastRatio(track, ground) < MARK_CONTRAST)
          .map((ground) => `#${index}: ${track} on ${ground}`),
      );
    });
    expect(bad).toEqual([]);
  });

  it("HUD's drawer switches: the word at AA off and on, the on frame at 3 to 1", () => {
    const bad = HUD_STYLES.flatMap((style, index) => {
      const vars = style.hud;
      if (!vars) return [`#${index}: no HUD paint`];
      const ground = solidOver(vars.drawer, vars.bg);
      const fill = solidOver(vars.accentFill, ground);
      const checks = [
        ['off word', contrastRatio(vars.text2, ground), AA_TEXT],
        ['on word', contrastRatio(vars.accent, fill), AA_TEXT],
        ['on frame', contrastRatio(vars.accent, ground), MARK_CONTRAST],
      ] as const;
      return checks
        .filter(([, ratio, least]) => ratio < least)
        .map(([what, ratio]) => `#${index}: ${what} ${floor2(ratio)}`);
    });
    expect(bad).toEqual([]);
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

  it("reads a style's own see-through colours (the vendored rgba), and no paint as the ground", () => {
    expect(solidOver('transparent', WHITE)).toBe(WHITE);
    expect(solidOver(rgba(INK, 1), WHITE)).toBe(INK);
    expect(solidOver(rgba(INK, 0), WHITE)).toBe(WHITE);
    expect(solidOver(rgba(INK, 0.5), WHITE)).toBe(mixHex(WHITE, INK, 0.5));
  });

  it('refuses to blend over a ground that is not solid, and a page that is not', () => {
    const veil = `${WHITE}80`;
    expect(() => solidOver(`${INK}80`, veil)).toThrow(/carries transparency/);
    expect(() => contrastFailures(palette({ background: veil }), TEXT_ON)).toThrow(
      /page is opaque/,
    );
  });
});
