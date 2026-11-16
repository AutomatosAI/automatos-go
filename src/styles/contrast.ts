// Text contrast over a palette, pure (docs/app-standard.md rule 10.4): every text colour on every
// ground the primitives draw it on, at WCAG AA. The list of those pairs (TEXT_ON) and the palettes
// it is measured in are the app's settings (src/release/__tests__/settings/contrast.ts), so the one
// test over them (__tests__/contrast.test.ts) covers every palette of every style, and a palette or
// a role an app adds is covered by naming it there. A text token that carries transparency
// (#RRGGBBAA) is blended over each ground before it is measured (rule 10.5).
// What this measures is the Text primitive's tones and the shape's foreground pairs. Shared code
// that paints the accent itself reads it from src/ui/accent.ts, whose own test holds it.

import { contrastRatio } from '../core/web/lib/look-kit/contrast';
import { toneColour } from '../ui/tone-colour';
import { TEXT_TONES, type TextTone } from '../ui/variants';
import { blendOver, readColour } from './tokens/colour-read';
import type { ColourName, Colours } from './tokens/types';

/** WCAG 2.x AA for text. */
export const AA_TEXT = 4.5;

export type TextOnGrounds = readonly [text: ColourName, grounds: readonly ColourName[]];

/**
 * The pairs as a palette draws them: where the Text primitive reads a tone from another token
 * (toneColour: the accent, in a palette whose `accent` is a ground), that token stands in.
 */
export function textOnFor(
  colours: Colours,
  pairs: readonly TextOnGrounds[],
): readonly TextOnGrounds[] {
  const swaps = new Map<ColourName, ColourName>(
    (Object.keys(TEXT_TONES) as TextTone[])
      .filter((tone) => toneColour(colours, tone) !== TEXT_TONES[tone])
      .map((tone) => [TEXT_TONES[tone], toneColour(colours, tone)]),
  );
  return pairs.map(([text, grounds]) => [swaps.get(text) ?? text, grounds] as const);
}

const unreadable = (colour: string) =>
  new Error(`${String(colour)} is not a colour this can read: a hex, rgb, rgba, hsl or hsla form`);

/**
 * A colour as it reads over an opaque ground: itself, or blended by its own alpha when it carries
 * one (src/styles/tokens/colour-read.ts reads every form a style or a theme writes, and
 * 'transparent' is the ground). Throws, naming the colour, for one it cannot read, and for a
 * see-through colour over a ground that carries transparency, which reads as nothing until it is
 * itself blended over what is behind it (contrastFailures blends a ground over the palette's page):
 * a test over the palette fails plainly on the token, never passes on it.
 */
export function solidOver(colour: string, ground: string): string {
  const ink = readColour(colour);
  if (ink === null) throw unreadable(colour);
  if (ink.alpha >= 1) return ink.hex;
  const under = readColour(ground);
  if (under === null) throw unreadable(ground);
  if (under.alpha < 1) throw new Error(`${ground} carries transparency: blend it over a solid`);
  return blendOver(colour, ground) ?? ground;
}

export type ContrastFailure = {
  readonly text: ColourName;
  readonly ground: ColourName;
  readonly ratio: number;
};

/**
 * Every pair in `pairs` that reads under `least` in this palette; empty when the palette passes.
 * A ground that carries transparency is measured as it sits on the page (`background`), and the
 * page itself is opaque: a palette whose page is not throws, naming it.
 */
export function contrastFailures(
  colours: Colours,
  pairs: readonly TextOnGrounds[],
  least: number = AA_TEXT,
): readonly ContrastFailure[] {
  const page = colours.background;
  const read = readColour(page);
  if (read === null) throw unreadable(page);
  if (read.alpha < 1) throw new Error(`background is ${page}: a palette's page is opaque`);
  return pairs.flatMap(([text, grounds]) =>
    grounds.flatMap((ground) => {
      const base = solidOver(colours[ground], page);
      const ratio = contrastRatio(solidOver(colours[text], base), base);
      return ratio >= least ? [] : [{ text, ground, ratio }];
    }),
  );
}
