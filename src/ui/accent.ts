// The accent as a colour that can be read, pure (docs/app-standard.md rule 10.4). The shared name
// `accent` is a colour you can read in most palettes (Studio's orange) and a quiet ground in
// others: Candy fills it with its chip, as the web's hover fill, and an installed theme may too.
// So text, a glyph, a rule or a dot "in the accent" is drawn in `accent` where that reads on the
// palette's page and on its cards, and in `primary`, the palette's strong ink, where it does not. Every shared
// place that paints the accent as a foreground reads it here. A ground in the accent, with its
// own accentForeground on it (the count badge), keeps `colours.accent`.

import { contrastRatio } from '../core/web/lib/look-kit/contrast';
import type { ColourName, Colours } from '../styles/tokens';

/** WCAG 1.4.11: the least a mark needs against what it sits on. */
export const MARK_CONTRAST = 3;

const SOLID_LENGTH = 7;
/** The colour without any alpha it carries: enough to tell a ground from an ink. */
const solid = (colour: string) => colour.slice(0, SOLID_LENGTH);

const found = new WeakMap<Colours, ColourName>();

/** The grounds a mark in the accent sits on: the page (a link, a rule) and a card (a dot, a chip). */
const GROUNDS: readonly ColourName[] = ['background', 'card'];
/** In order: the accent itself, the palette's strong ink, then its main ink, which always reads. */
const CANDIDATES: readonly ColourName[] = ['accent', 'primary', 'foreground'];
const LAST_RESORT: ColourName = 'foreground';

function readsOn(colours: Colours, token: ColourName, grounds: readonly ColourName[]): boolean {
  const ink = solid(colours[token]);
  return grounds.every((ground) => contrastRatio(ink, solid(colours[ground])) >= MARK_CONTRAST);
}

/**
 * The first of `candidates` that reads as a mark (3 to 1) on every one of `grounds` in this
 * palette, else `fallback`. The accent's lookup below, and the switch's track and thumb
 * (switch-model.ts), are this.
 */
export function firstMark(
  colours: Colours,
  candidates: readonly ColourName[],
  grounds: readonly ColourName[],
  fallback: ColourName,
): ColourName {
  return candidates.find((each) => readsOn(colours, each, grounds)) ?? fallback;
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

const SOLID_HEX = /^#[0-9a-f]{6}$/i;

/**
 * A mark that sits on a control's own fill (a status dot inside a pill): the mark's colour, or the
 * token's own where the mark would be lost in that fill, as a dot in the accent is on a pill chosen
 * in the accent. A fill that is not one solid colour is no fill: the mark sits on what is behind.
 */
export function markOn(colours: Colours, token: ColourName, fill: string): string {
  const mark = markColour(colours, token);
  if (!SOLID_HEX.test(fill)) return mark;
  return contrastRatio(solid(mark), fill) >= MARK_CONTRAST ? mark : colours[token];
}
