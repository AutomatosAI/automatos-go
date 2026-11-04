// A thread's end kept in view when the thread's view shrinks under someone reading there: the
// keyboard coming up over the message box (KeyboardAvoidingView pads the screen, so the list loses
// its foot), or a pinned suggestion growing above it. The list scrolls to the end only when a row
// is added (shouldScrollToEnd), so without this the newest rows slide under the box and the top of
// a bubble peeks above it. Someone scrolled back up through the thread stays where they are. HUD's
// transcript follows its end the same way (hud/core/model.ts transcriptAtEnd).

/** How near the end still counts as at it, in points: about a row's spacing. */
export const END_SLACK = 24;

/** Where the list was: its scroll offset, its view's height and its content's height. */
export type ListMetrics = {
  readonly offset: number;
  readonly view: number;
  readonly content: number;
};

export const NO_METRICS: ListMetrics = Object.freeze({ offset: 0, view: 0, content: 0 });

/** The view reaches the content's end, give or take the slack (a list that fits always does). */
export function atListEnd({ offset, view, content }: ListMetrics): boolean {
  return offset + view >= content - END_SLACK;
}

/** The list's view shrank to `nextView` while it was at its end: scroll back to the end. */
export function keepsEndInView(before: ListMetrics, nextView: number): boolean {
  return nextView < before.view && atListEnd(before);
}

/** Where a list scrolled to its end is: its last view of the content, or the top if it fits. */
export function endMetrics(content: number, view: number): ListMetrics {
  return { offset: Math.max(0, content - view), view, content };
}

/** The scroll a content size change carries out: none, a thread's opening rows, or a new row. */
export type PendingScroll = 'none' | 'open' | 'add';

/**
 * The scroll the rows going from `previous` to `count` call for. Counted from none, so the rows a
 * thread opens with, already loaded, open it at its newest (#51), not animated: unless it opens at
 * a focus message, which its own scroll finds. A row added after that scrolls to it; nothing else
 * scrolls (never a reply as it grows).
 */
export function pendingScrollOf(previous: number, count: number, focusing: boolean): PendingScroll {
  if (count <= previous) return 'none'; // shouldScrollToEnd's rule: only a row added
  if (previous === 0) return focusing ? 'none' : 'open';
  return 'add';
}
