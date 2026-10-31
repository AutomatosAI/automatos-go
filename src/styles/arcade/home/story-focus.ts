// Opening Arcade's story at a message (PRD-268 US-G03), pure; the rules are src/chat/focus.ts's, as
// use-focus-scroll.ts keeps them for Studio's and Play's FlatLists. The story is a ScrollView inside
// the handheld's own ScrollView (a FlatList there would nest one virtualised list in another), so it
// records each entry's top as it is laid out (withPlace, keyed by the entry's key: a saved message's
// id, as the view-model keys its rows) and scrolls there, not animated, its top at the window's top,
// once the focus's entry is drawn and laid out. Every id it scrolled to counts, so a route's focus
// never pulls the story back after a later one, and each focus is handled once. The reply the
// dialogue window says is not in the story's words: it settles at once, without a scroll, because
// the dialogue shows it. Pure: no React, React Native, Expo or Skia.

import { focusIndex, shouldFocus } from '../../../chat/focus';

/** Each laid-out entry's top in the story's content, by its key. */
export type StoryPlaces = ReadonlyMap<string, number>;

/** What an entry's onLayout says of it. */
export type EntryLayout = { readonly y: number; readonly height: number };

/**
 * The places with this entry's top; an entry with no height draws nothing (the reply the dialogue
 * says, or a window the style hides), so it has no place. The same map back when nothing changed.
 */
export function withPlace(places: StoryPlaces, key: string, layout: EntryLayout): StoryPlaces {
  if (layout.height > 0 && Number.isFinite(layout.y)) {
    if (places.get(key) === layout.y) return places;
    return new Map([...places, [key, layout.y]]);
  }
  if (!places.has(key)) return places;
  return new Map([...places].filter(([each]) => each !== key));
}

export type StoryFocusFacts = {
  /** The message the story opens at (useThreadFocus); null for none. */
  readonly focus: string | null;
  /** Every id already handled. */
  readonly done: ReadonlySet<string>;
  /** The focus's entry among the story's entries (focus.ts focusIndex), -1 while it is not there. */
  readonly index: number;
  /** The message the dialogue window says (sayingOf's), null for none or the reply being written. */
  readonly sayingId: string | null;
  readonly places: StoryPlaces;
};

export type StoryFocusStep =
  /** Nothing to do yet: no focus, done already, its entry not drawn or not laid out. */
  | { readonly kind: 'wait' }
  /** The dialogue says it: done, no scroll. */
  | { readonly kind: 'settle'; readonly messageId: string }
  /** Scroll the story to `y`, then done. */
  | { readonly kind: 'scroll'; readonly messageId: string; readonly y: number };

const WAIT: StoryFocusStep = Object.freeze({ kind: 'wait' });

/** The focus's entry, as focus.ts finds a row: by its key among the entries drawn. */
export function storyFocusIndex(
  entries: readonly { readonly key: string }[],
  focus: string | null,
): number {
  return focus === null ? -1 : focusIndex(entries, focus);
}

/** What the story does with its focus now (focus.ts shouldFocus, then the dialogue, then a place). */
export function storyFocusStep(facts: StoryFocusFacts): StoryFocusStep {
  const { focus, done, index, sayingId, places } = facts;
  if (focus === null || !shouldFocus(focus, done, index)) return WAIT;
  if (focus === sayingId) return Object.freeze({ kind: 'settle', messageId: focus });
  const y = places.get(focus);
  return y === undefined ? WAIT : Object.freeze({ kind: 'scroll', messageId: focus, y });
}
