// A sheet route for the tests, without React or expo-router: a router that records what it did (and
// marks a push made while the sheet route was still presented), and the hook's wiring of
// sheet-exit.ts over it (the first exit asked for is left after the slide; unmount cancels).

import {
  firstExit,
  leaveAfterSlide,
  sheetExits,
  type SheetExit,
  type SheetExits,
  type SheetNavigation,
} from '../sheet-exit';

/** Written in place of a push made while the sheet route was still presented. */
export const OVER_THE_SHEET = 'over the sheet';

export type RecordingRouter = {
  readonly calls: readonly string[];
  readonly navigation: SheetNavigation;
};

export function recordingRouter(): RecordingRouter {
  const calls: string[] = [];
  let presented = true;
  const navigation: SheetNavigation = {
    goBack: () => {
      calls.push('back');
      presented = false;
    },
    replace: (href) => {
      calls.push(`replace ${href}`);
      presented = false;
    },
    push: (href) => {
      calls.push(presented ? `push ${href} ${OVER_THE_SHEET}` : `push ${href}`);
    },
  };
  return { calls, navigation };
}

export type TestSheetRoute = SheetExits & {
  readonly calls: readonly string[];
  readonly unmount: () => void;
};

export function testSheetRoute(): TestSheetRoute {
  const router = recordingRouter();
  let exit: SheetExit | null = null;
  let cancel: () => void = () => undefined;
  const exits = sheetExits((next) => {
    const settled = firstExit(exit, next);
    if (settled === exit) return;
    exit = settled;
    cancel = leaveAfterSlide(settled, router.navigation);
  });
  return { ...exits, calls: router.calls, unmount: () => cancel() };
}
