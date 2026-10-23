// The header menu's state (D73): whether the sheet shows, and the way out of it. The menu is the
// foundation's Sheet with no route of its own (so the transparentModal trap in
// src/cc/use-sheet-route.ts can't happen); a row slides the sheet away first and pushes its screen
// only after the slide (SHEET_DURATION_MS), as the Calendar's item sheet does (useItemSheet). The
// rules are menu.ts's (menuTrip, menuSheetShown): a second tap while one is on its way does
// nothing, so a screen is never pushed twice, and the screen the header sits on is not pushed again.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { SHEET_DURATION_MS } from '../../ui/overlay';
import { menuSheetShown, menuTrip } from './menu';

export type HomeMenuState = {
  readonly visible: boolean;
  readonly open: () => void;
  readonly close: () => void;
  /** Slide the sheet away, then open this route. */
  readonly go: (route: string) => void;
};

/** `here`: the menu route the screen already is (menu.ts menuHere), or null. */
export function useHomeMenu(here: string | null): HomeMenuState {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    if (next === null) return undefined;
    const timer = setTimeout(() => {
      setNext(null);
      router.push(next);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [next, router]);

  const open = useCallback(() => setShown(true), []);
  const close = useCallback(() => setShown(false), []);
  const go = useCallback(
    (route: string) => {
      setShown(false);
      setNext((pending) => menuTrip(pending, route, here));
    },
    [here],
  );

  return { visible: menuSheetShown(shown, next), open, close, go };
}
