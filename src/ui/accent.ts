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

/** `accent` where it reads on the palette's page and cards, `primary` where it is a ground there. */
export function accentToken(colours: Colours): ColourName {
  const known = found.get(colours);
  if (known !== undefined) return known;
  const accent = solid(colours.accent);
  const reads = GROUNDS.every(
    (ground) => contrastRatio(accent, solid(colours[ground])) >= MARK_CONTRAST,
  );
  const token: ColourName = reads ? 'accent' : 'primary';
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
