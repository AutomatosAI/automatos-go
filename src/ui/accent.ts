// The accent as a colour that can be read, pure (docs/app-standard.md rule 10.4). The shared name
// `accent` is a colour you can read in most palettes (Studio's orange) and a quiet ground in
// others: Candy fills it with its chip, as the web's hover fill, and an installed theme may too.
// So text, a glyph, a rule or a dot "in the accent" is drawn in `accent` where that reads on the
// palette's page and on its cards, and in `primary`, the palette's strong ink, where it does not. Every shared
// place that paints the accent as a foreground reads it here. A ground in the accent, with its
// own accentForeground on it (the count badge), keeps `colours.accent`.
//   Each candidate is measured as it is drawn: a ground over the page, the mark over that, with
// any alpha a token carries (src/styles/tokens/colour-read.ts). A candidate, a ground or a page
// that cannot be read reads as nothing, so it is skipped and the lookup never throws, whatever an
// installed theme supplies.

import { contrastRatio } from '../core/web/lib/look-kit/contrast';
import type { ColourName, Colours } from '../styles/tokens';
import { blendOver, readColour } from '../styles/tokens/colour-read';

/** WCAG 1.4.11: the least a mark needs against what it sits on. */
export const MARK_CONTRAST = 3;

const found = new WeakMap<Colours, ColourName>();

/** The grounds a mark in the accent sits on: the page (a link, a rule) and a card (a dot, a chip). */
const GROUNDS: readonly ColourName[] = ['background', 'card'];
/** In order: the accent itself, the palette's strong ink, then its main ink, which always reads. */
const CANDIDATES: readonly ColourName[] = ['accent', 'primary', 'foreground'];
const LAST_RESORT: ColourName = 'foreground';

/**
 * How `ink` reads on `ground` as drawn: the ground over the page, the ink over that. 0 where any of
 * them cannot be read (an unknown form, or a page that is not solid), so it never passes.
 */
export function markRatio(ink: string, ground: string, page: string): number {
  const under = blendOver(ground, page);
  const over = under === null ? null : blendOver(ink, under);
  return under === null || over === null ? 0 : contrastRatio(over, under);
}

function readsOn(ink: string, grounds: readonly string[], page: string): boolean {
  return grounds.every((ground) => markRatio(ink, ground, page) >= MARK_CONTRAST);
}

/**
 * The first of `candidates` that reads as a mark (3 to 1) on every one of `grounds` in this
 * palette, each as it is drawn over the page, else `fallback`. The accent's lookup below, and the
 * switch's tracks (switch-model.ts), are this.
 */
export function firstMark(
  colours: Colours,
  candidates: readonly ColourName[],
  grounds: readonly ColourName[],
  fallback: ColourName,
): ColourName {
  const under = grounds.map((ground) => colours[ground]);
  const page = colours.background;
  return candidates.find((each) => readsOn(colours[each], under, page)) ?? fallback;
}

/**
 * The same lookup on a style's own colours, for a part a style draws in its own paint (Candy's
 * Motion switch): the first of `candidates` that reads as a mark on every one of `grounds`, the
 * first of which is the page the others sit on.
 */
export function firstMarkColour(
  candidates: readonly string[],
  grounds: readonly string[],
  fallback: string,
): string {
  const page = grounds[0] ?? fallback;
  return candidates.find((each) => readsOn(each, grounds, page)) ?? fallback;
}

/**
 * `accent` where it reads on the palette's page and cards; where it is a ground there, the first
 * of `primary` and `foreground` that does read on both.
 */
export function accentToken(colours: Colours): ColourName {
  const known = found.get(colours);
  if (known !== undefined) return known;
  const token = firstMark(colours, CANDIDATES, GROUNDS, LAST_RESORT);
  found.set(colours, token);
  return token;
}

/** The accent as a foreground: text, a glyph, a rule, a dot. */
export function accentInk(colours: Colours): string {
  return colours[accentToken(colours)];
}

/** A token painted as a mark (a status dot): its own colour, the accent through the lookup. */
export function markColour(colours: Colours, token: ColourName): string {
  return token === 'accent' ? accentInk(colours) : colours[token];
}

/**
 * A mark that sits on a control's own fill (a status dot inside a pill): the mark's colour, or the
 * token's own where the mark would be lost in that fill, as a dot in the accent is on a pill chosen
 * in the accent. A fill that is not one solid colour is no fill: the mark sits on what is behind.
 */
export function markOn(colours: Colours, token: ColourName, fill: string): string {
  const mark = markColour(colours, token);
  const filled = readColour(fill);
  if (filled === null || filled.alpha < 1) return mark;
  return markRatio(mark, fill, fill) >= MARK_CONTRAST ? mark : colours[token];
}
