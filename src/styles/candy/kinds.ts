// The gradient a Deliverable's square wears in Candy (PRD-001 §4.6.2; CANDY-LAYOUT §4 P2 and P3; the
// kit's deliverables/shelf.ts setOfKind at 3920359d5): its kind's card set over the kit's KIND_SETS
// (sets.ts kindSetOf), with the app's type names spelt the kit's way (repoContradictions: the app's
// 'slide' and 'blog_post', src/cc/deliverables/types.ts KNOWN_TYPES, are the kit's 'slides' and
// 'blog'). Report and slides wear the first set (pink in Blush), document and spreadsheet the second
// (violet), image and blog post the third (blue); any other kind, and none, the first. The Chat
// view's Deliverable rows (a chat names a document, an image or a video) and the Shelf's tiles
// (US-023i) read it. Pure: no React, React Native, Expo or Skia.

import { kindSetOf, type CardSet } from './sets';

/** The app's type names the kit's KIND_SETS spells otherwise. */
export const KIT_KIND_NAMES: ReadonlyMap<string, string> = new Map([
  ['slide', 'slides'],
  ['blog_post', 'blog'],
]);

/** A Deliverable's card set by its type: the app's name ('slide', 'blog_post') or the kit's. */
export function deliverableSetOf(kind: string | null | undefined): CardSet {
  const key = (kind ?? '').trim().toLowerCase();
  return kindSetOf(KIT_KIND_NAMES.get(key) ?? key);
}
