// The header's logic, pure (the app standard's rules 4.2 and 3.3): what the one bar draws, so
// Header.tsx only wires. A bar is back, a title and at most two actions. Back is drawn on every
// screen but a tab's root. The title is always in the bar, unless the screen has a large title at
// the top of its scrolling content: then the bar's own title appears once that one has scrolled
// away, so the two are never read at once. Every button is the IconButton, 36 with its slop to 44.
// The bar's least height, its side padding and its gap are the template's (HEADER_BAR: the 44 pt
// row of the bars home and Older chats share, D73), and headerKeepsTouch says whether such values
// keep every button's slop inside the bar. An app sets its own here.

import type { SpaceName } from '../styles/tokens';
import { MIN_TOUCH, hitSlopFor } from './paint';
import { ICON_BUTTON_SIZES, type IconButtonSize, type TextLevel } from './variants';

/** The bar's buttons, back and the actions: the template's size for a header's buttons. */
export const HEADER_BUTTON_SIZE: IconButtonSize = 'md';

/** The bar's own title: Title 4, the title the template's bars draw (D73), never a large one. */
export const HEADER_TITLE_LEVEL: TextLevel = 4;
/** The bar's title wraps once before it is cut short, so a long one survives the larger text sizes. */
export const HEADER_TITLE_LINES = 2;

/** How often a scroll view tells the collapsing title where it is, in milliseconds: every frame. */
export const SCROLL_EVENT_THROTTLE_MS = 16;

/** The bar's room, in points or the spacing token each is drawn from. */
export type HeaderChrome = Readonly<{ minHeight: number; paddingX: SpaceName; gap: SpaceName }>;

/**
 * The template's bar: at least 44 tall, 6 pt in from each side (a control at the edge, as D73's
 * bars), and 8 pt between two items, so two buttons' slops never meet.
 */
export const HEADER_BAR: HeaderChrome = Object.freeze({
  minHeight: MIN_TOUCH,
  paddingX: 'space2',
  gap: 'space3',
});

/** A bar holds two actions at the most (rule 4.2): one for each of these places. */
const ACTION_PLACES = ['first', 'second'] as const;

/** An action in the bar, with the place it is drawn at: a key that cannot repeat. */
export type PlacedAction<Action> = Readonly<{
  place: (typeof ACTION_PLACES)[number];
  action: Action;
}>;

/** The actions a bar draws: the first two it was given, each at its place. A third is never drawn. */
export function headerActions<Action>(
  actions: readonly Action[] | undefined,
): readonly PlacedAction<Action>[] {
  return ACTION_PLACES.flatMap((place, index) => {
    const action = actions?.[index];
    return action === undefined ? [] : [Object.freeze({ place, action })];
  });
}

/** Whether the bar draws the way back: on every screen but a tab's root. */
export function showsBack(root: boolean | undefined): boolean {
  return root !== true;
}

/** The bar's least height: the one given, and never under the touch target. */
export function headerMinHeight(given: number): number {
  return Math.max(MIN_TOUCH, Number.isFinite(given) ? given : 0);
}

/** A screen's large title, as the bar needs to know it: whether it has scrolled away. */
export type CollapsingTitle = Readonly<{ gone: boolean }>;

/**
 * Whether the bar shows its own title: always on a screen with no large title, and on a screen
 * with one only once that one has scrolled away.
 */
export function barTitleShown(collapsing: CollapsingTitle | undefined): boolean {
  return collapsing === undefined || collapsing.gone;
}

/** Where a view sits inside its parent, as its layout event gives it. */
export type Placed = Readonly<{ y: number; height: number }>;

/**
 * Where the large title ends, measured down from the top of the scroll content: the bottom edge
 * of the view that holds it. That view's layout must be given against the scroll content itself
 * (use-collapsing-title.ts says how), so whatever sits above the title in the content is counted.
 * Null for a layout that is not a size: the title has not been measured.
 */
export function largeTitleEnd(layout: Placed): number | null {
  const end = layout.y + layout.height;
  return Number.isFinite(end) && layout.height > 0 && end > 0 ? end : null;
}

/**
 * Whether the large title has scrolled away: the content has moved up by at least where the
 * title ends. A title that has not been measured yet has not gone anywhere.
 */
export function largeTitleGone(offsetY: number, titleEnd: number | null): boolean {
  if (titleEnd === null || !(titleEnd > 0)) return false;
  return Number.isFinite(offsetY) && offsetY >= titleEnd;
}

export type HeaderRoom = Readonly<{ minHeight: number; paddingX: number; gap: number }>;

/**
 * Whether a bar of these sizes keeps every button's 44 pt touch inside it: a touch never lands
 * outside the parent's box, slop or not (paint.ts). The bar must be tall enough for the slop
 * above and below, its side padding wide enough for the slop at each end, and two buttons far
 * enough apart that their slops do not meet. The template's HEADER_BAR is held to this by a test.
 */
export function headerKeepsTouch(room: HeaderRoom): boolean {
  const { box } = ICON_BUTTON_SIZES[HEADER_BUTTON_SIZE];
  const slop = hitSlopFor(box, box);
  const tall = room.minHeight >= box + slop.top + slop.bottom;
  const wide = room.paddingX >= slop.left && room.paddingX >= slop.right;
  return tall && wide && room.gap >= slop.left + slop.right;
}
