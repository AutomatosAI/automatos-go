// Where Back goes, pure (the app standard's rule 4.2): the screen before this one when there is
// one, or the fallback (home) when the screen was opened first (a link or a notification), so a
// back button never leaves the person stranded on an empty stack. Back stays where it is, and does
// nothing, on a tab's root (the place itself) and where nothing is behind and the fallback is this
// very screen (a tab's root opened first is its own fallback): replacing a screen with itself is no
// way back. The Header draws no way back where the answer is stay (header-model.ts showsBack), so
// the bar and the press never disagree. Routes are compared as the router matches them
// (screenPath). use-go-back.ts asks the router whether a screen is behind and where the person is,
// and does what this says.

export type BackMove =
  | Readonly<{ kind: 'back' }>
  | Readonly<{ kind: 'replace'; href: string }>
  | Readonly<{ kind: 'stay' }>;

/** Where the person is, as Back needs to know it. */
export type BackPlace = Readonly<{
  /** The router has a screen behind this one. */
  canGoBack: boolean;
  /** Where Back goes when nothing is behind: home, unless the screen names another. */
  fallback: string;
  /** The screen showing now, as the router names it (usePathname). */
  here: string;
  /** A tab's root: the place itself, with no way back from it (rule 5.4). */
  root?: boolean;
}>;

const BACK: BackMove = Object.freeze({ kind: 'back' });
const STAY: BackMove = Object.freeze({ kind: 'stay' });
const QUERY_OR_FRAGMENT = /[?#]/;

/** A group segment, as '(app)': it names a layout, not a place, so the router leaves it out. */
function isGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

/**
 * The screen an href shows, as the router matches it: no query or fragment, no group segment and
 * no empty one (so no trailing slash, and no doubled one). '/(app)/settings/?tab=1' is '/settings'.
 */
export function screenPath(href: string): string {
  const path = href.split(QUERY_OR_FRAGMENT, 1)[0].trim();
  const segments = path.split('/').filter((segment) => segment !== '' && !isGroup(segment));
  return `/${segments.join('/')}`;
}

/** Whether two hrefs show the same screen. */
export function sameScreen(first: string, second: string): boolean {
  return screenPath(first) === screenPath(second);
}

/**
 * Back when there is a screen behind; otherwise the fallback, in this screen's place; stay on a
 * tab's root, and where nothing is behind and the fallback is the screen already showing.
 */
export function backMove(place: BackPlace): BackMove {
  if (place.root === true) return STAY;
  if (place.canGoBack) return BACK;
  if (sameScreen(place.fallback, place.here)) return STAY;
  return Object.freeze({ kind: 'replace', href: place.fallback });
}
