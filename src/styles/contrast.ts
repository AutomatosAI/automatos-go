// Text contrast over a palette, pure (docs/app-standard.md rule 10.4): every text colour on every
// ground the primitives draw it on, at WCAG AA. TEXT_ON is that list for the shared token shape
// (tokens/types.ts), so the one test over it (__tests__/contrast.test.ts) covers every palette of
// every style, and a palette an app adds is covered by naming it there. A text token that carries
// transparency (#RRGGBBAA) is blended over each ground before it is measured (rule 10.5).
// What this measures is the Text primitive's tones and the shape's foreground pairs. A screen that
// paints a colour itself (a link, a mark) is not seen here.

import { contrastRatio, mixHex } from '../core/web/lib/look-kit/contrast';
import { toneColour } from '../ui/tone-colour';
import { TEXT_TONES, type TextTone } from '../ui/variants';
import type { ColourName, Colours, StyleId } from './tokens/types';

/** WCAG 2.x AA for text. */
export const AA_TEXT = 4.5;

export type TextOnGrounds = readonly [text: ColourName, grounds: readonly ColourName[]];

/** Each text colour and the grounds the primitives draw it on (src/ui/variants.ts TEXT_TONES). */
export const TEXT_ON: readonly TextOnGrounds[] = Object.freeze([
  ['foreground', ['background', 'card', 'secondary', 'muted']],
  ['mutedForeground', ['background', 'card', 'secondary', 'muted']],
  ['fg2', ['background', 'card']],
  ['fg3', ['background', 'card']],
  ['cardForeground', ['card']],
  ['popoverForeground', ['popover']],
  ['secondaryForeground', ['secondary']],
  ['primaryForeground', ['primary']],
  ['accentForeground', ['accent']],
  ['destructiveForeground', ['destructive']],
  ['successForeground', ['success']],
  ['infoForeground', ['info']],
  ['warningForeground', ['warning']],
  ['accent', ['background', 'card']],
  ['olive', ['background', 'card']],
  ['navy', ['background', 'card']],
  ['warnInk', ['background', 'card']],
  ['destructive', ['background', 'card']],
]);

/**
 * TEXT_ON as a style draws it: where the style reads a tone from another token (toneColour:
 * Candy's accent), that token stands in for the tone's own.
 */
export function textOnFor(style: StyleId): readonly TextOnGrounds[] {
  const swaps = new Map<ColourName, ColourName>(
    (Object.keys(TEXT_TONES) as TextTone[])
      .filter((tone) => toneColour(style, tone) !== TEXT_TONES[tone])
      .map((tone) => [TEXT_TONES[tone], toneColour(style, tone)]),
  );
  return TEXT_ON.map(([text, grounds]) => [swaps.get(text) ?? text, grounds] as const);
}

const SOLID_LENGTH = 7;
const ALPHA_MAX = 255;
const HEX_RADIX = 16;

const isSolid = (colour: string) => colour.length <= SOLID_LENGTH;

/**
 * A colour as it reads over an opaque ground: itself, or blended by its own alpha when it carries
 * one. Throws for a ground that carries transparency, which reads as nothing until it is itself
 * blended over what is behind it (contrastFailures blends a ground over the palette's page).
 */
export function solidOver(colour: string, ground: string): string {
  if (isSolid(colour)) return colour;
  if (!isSolid(ground)) throw new Error(`${ground} carries transparency: blend it over a solid`);
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
  pairs: readonly TextOnGrounds[] = TEXT_ON,
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
