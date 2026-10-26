// A Command Centre route drawn as the foundation's bottom sheet (the ticket, a social post). The
// route is a transparent modal in the Command Centre's own stack (SHEET_ROUTE_OPTIONS, given in
// app/(app)/cc/_layout.tsx): on iOS react-native-screens presents it as a native modal over the full
// screen, above the tab it opened from, and the sheet itself is src/ui/Sheet (a React Native Modal)
// on top of that. A screen pushed in the parent (app) stack never dismisses the nested stack's native
// modal: pushed while the route is presented, the chat would sit under an invisible full-screen modal
// that takes every touch. So the route is always left before another screen opens (sheet-exit.ts):
// the sheet slides away, then the route goes, back (or the fallback when it was opened first, from a
// link), replaced by another Command Centre screen (Questions, a Deliverable), or back and only then
// the pushed screen (Ask Auto about's chat), so back from the chat lands on the screen the sheet was
// opened over. The sheet also shows only while its route is focused, and only then is it the open
// sheet (open-sheet.ts) that a notification's tap leaves through, with the same push.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGoBack } from '../navigation/use-go-back';
import { openSheets } from './open-sheet';
import {
  firstExit,
  leaveAfterSlide,
  sheetExits,
  type SheetExit,
  type SheetExits,
} from './sheet-exit';

/** The route's screen: no frame of its own, over the tab, appearing at once (the sheet slides). */
export const SHEET_ROUTE_OPTIONS = Object.freeze({
  presentation: 'transparentModal' as const,
  animation: 'none' as const,
  contentStyle: Object.freeze({ backgroundColor: 'transparent' }),
});

export type SheetRoute = SheetExits & { readonly visible: boolean };

function useFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/** While the route is focused, the open sheet: a screen opened from outside leaves through it. */
function useOpenWhileFocused(leaveFor: (href: string) => void): void {
  useFocusEffect(useCallback(() => openSheets.attach({ leaveFor }), [leaveFor]));
}

export function useSheetRoute(fallback: string): SheetRoute {
  const router = useRouter();
  const goBack = useGoBack(fallback);
  const focused = useFocused();
  const [exit, setExit] = useState<SheetExit | null>(null);

  useEffect(() => {
    if (!exit) return undefined;
    return leaveAfterSlide(exit, {
      goBack,
      replace: (href) => router.replace(href),
      push: (href) => router.push(href),
    });
  }, [exit, goBack, router]);

  const exits = useMemo(
    () => sheetExits((next) => setExit((current) => firstExit(current, next))),
    [],
  );
  useOpenWhileFocused(exits.push);
  return useMemo(() => ({ ...exits, visible: focused && exit === null }), [exits, focused, exit]);
}
