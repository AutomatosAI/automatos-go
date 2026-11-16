// Text contrast over a palette, pure (docs/app-standard.md rule 10.4): every text colour on every
// ground the primitives draw it on, at WCAG AA. The list of those pairs (TEXT_ON) and the palettes
// it is measured in are the app's settings (src/release/__tests__/settings/contrast.ts), so the one
// test over them (__tests__/contrast.test.ts) covers every palette of every style, and a palette or
// a role an app adds is covered by naming it there. A text token that carries transparency
// (#RRGGBBAA) is blended over each ground before it is measured (rule 10.5).
// What this measures is the Text primitive's tones and the shape's foreground pairs. Shared code
// that paints the accent itself reads it from src/ui/accent.ts, whose own test holds it.

import { contrastRatio, mixHex, toHex } from '../core/web/lib/look-kit/contrast';
import { toneColour } from '../ui/tone-colour';
import { TEXT_TONES, type TextTone } from '../ui/variants';
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

const SOLID_LENGTH = 7;
const ALPHA_MAX = 255;
const HEX_RADIX = 16;
/** No paint: what is behind shows. */
const CLEAR = 'transparent';
/** The vendored rgba()'s form (0 to 255 channels and an alpha), as the styles' own colours carry. */
const RGBA = /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d*\.?\d+)\)$/;

const isSolid = (colour: string) => colour.length <= SOLID_LENGTH;

/** An rgba() colour over a solid ground, or null for a colour of another form. */
function rgbaOver(colour: string, ground: string): string | null {
  const match = RGBA.exec(colour);
  if (!match) return null;
  const [, red, green, blue, alpha] = match.map(Number);
  return mixHex(ground, toHex([red ?? 0, green ?? 0, blue ?? 0]), alpha ?? 1);
}

/**
 * A colour as it reads over an opaque ground: itself, or blended by its own alpha when it carries
 * one (#RRGGBBAA, or rgba() as a style's own colours write it); 'transparent' is the ground. Throws
 * for a ground that carries transparency, which reads as nothing until it is itself blended over
 * what is behind it (contrastFailures blends a ground over the palette's page).
 */
export function solidOver(colour: string, ground: string): string {
  if (isSolid(colour)) return colour;
  if (!isSolid(ground)) throw new Error(`${ground} carries transparency: blend it over a solid`);
  if (colour === CLEAR) return ground;
  const blended = rgbaOver(colour, ground);
  if (blended !== null) return blended;
  const alpha = parseInt(colour.slice(SOLID_LENGTH), HEX_RADIX) / ALPHA_MAX;
  return mixHex(ground, colour.slice(0, SOLID_LENGTH), alpha);
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
  if (!isSolid(page)) throw new Error(`background is ${page}: a palette's page is opaque`);
  return pairs.flatMap(([text, grounds]) =>
    grounds.flatMap((ground) => {
      const base = solidOver(colours[ground], page);
      const ratio = contrastRatio(solidOver(colours[text], base), base);
      return ratio >= least ? [] : [{ text, ground, ratio }];
    }),
  );
}
