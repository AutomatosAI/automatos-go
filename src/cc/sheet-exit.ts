// How a sheet route is left (use-sheet-route.ts), pure: the sheet slides away first and, after
// SHEET_DURATION_MS, the route goes. Back (Close, the backdrop, a decision taken); replaced by
// another Command Centre screen (Questions, a Deliverable); or back and only then a screen pushed
// (Ask Auto about's chat), never pushed while the sheet route is still presented. The first exit
// asked for wins: a second tap while the sheet slides away changes nothing.

import { SHEET_DURATION_MS } from '../ui/overlay';

export type SheetExit =
  | { readonly kind: 'back' }
  | { readonly kind: 'replace'; readonly href: string }
  | { readonly kind: 'push'; readonly href: string };

/** What a sheet asks of its route. */
export type SheetExits = {
  /** Slide away, then back (Close, the backdrop, Android's back, a decision taken). */
  readonly close: () => void;
  /** Slide away, then this Command Centre screen in the sheet's place. */
  readonly replaceWith: (href: string) => void;
  /** Slide away, leave the route the way close does, then this screen (the chat). */
  readonly push: (href: string) => void;
};

/** The router as leaving uses it: the back path (back, or the fallback), replace and push. */
export type SheetNavigation = {
  readonly goBack: () => void;
  readonly replace: (href: string) => void;
  readonly push: (href: string) => void;
};

const BACK: SheetExit = Object.freeze({ kind: 'back' });

/** The exit already asked for, else the new one. */
export function firstExit(current: SheetExit | null, next: SheetExit): SheetExit {
  return current ?? next;
}

/** The sheet's exits, each handed to `ask` (the hook keeps the first). */
export function sheetExits(ask: (exit: SheetExit) => void): SheetExits {
  return {
    close: () => ask(BACK),
    replaceWith: (href: string) => ask({ kind: 'replace', href }),
    push: (href: string) => ask({ kind: 'push', href }),
  };
}

/** Leave the route the exit's way: a push leaves it first (the back path), then pushes. */
export function leaveSheet(exit: SheetExit, navigation: SheetNavigation): void {
  if (exit.kind === 'replace') {
    navigation.replace(exit.href);
    return;
  }
  navigation.goBack();
  if (exit.kind === 'push') navigation.push(exit.href);
}

/** Leave once the sheet has slid away; returns the cancel (the route unmounted first). */
export function leaveAfterSlide(exit: SheetExit, navigation: SheetNavigation): () => void {
  const timer = setTimeout(() => leaveSheet(exit, navigation), SHEET_DURATION_MS);
  return () => clearTimeout(timer);
}
