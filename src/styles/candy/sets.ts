// Which of the three card gradients a thing wears in Candy, and the letter on its avatar (PRD-001
// §4.6.2, KA3-VENDOR-PIN): cards, avatars and rows cycle through the palette's three gradients in
// screen order (the design's "Mixed"; One colour paints all three the same, so nothing here changes
// for it), and a Deliverable takes its kind's (tokens/candy-catalogue.ts KIND_SETS, which maps the
// app's 'slide' and 'blog_post' as well). Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/ui/sets.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 9d1a05740088e6c80a88d7e46818e74c37b264ae1118934176d2ed37f390794a. Copied; only the import
// path and the layout (semicolons) are the repo's.

import { KIND_SETS } from '../tokens/candy-catalogue';

export type CardSet = 1 | 2 | 3;

/** The gradient of the thing at `index` in screen order: 1, 2, 3, 1, … */
export function cardSetOf(index: number): CardSet {
  return ((((index % 3) + 3) % 3) + 1) as CardSet;
}

/** A Deliverable kind's gradient: report and slides the first, document and spreadsheet the second, image and blog
 * post the third. Any other kind takes the first. */
export function kindSetOf(kind: string | null | undefined): CardSet {
  const key = (kind ?? '').toLowerCase();
  return Object.hasOwn(KIND_SETS, key) ? KIND_SETS[key] : 1;
}

/** A name's first letter, upper-cased, for an avatar; '?' for a name with none. */
export function initialOf(name: string | null | undefined): string {
  const letter = (name ?? '').trim().match(/\p{L}|\p{N}/u)?.[0];
  return letter ? letter.toLocaleUpperCase() : '?';
}
