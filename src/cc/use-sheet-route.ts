// A Command Centre route drawn as the foundation's bottom sheet (the ticket, a social post): the
// route is a transparent modal over the tab it opened from (SHEET_ROUTE_OPTIONS, given in
// app/(app)/cc/_layout.tsx), and the sheet itself is src/ui/Sheet (a native Modal). The sheet shows
// only while its route is focused, so a screen pushed over it (the chat Ask Auto about opens) never
// sits under the Modal: the sheet slides away, and slides back when that screen is closed. Closing
// slides it away first, then leaves the route: back (or the fallback when it was opened first, from
// a link), or replaced by another Command Centre screen (Questions, a Deliverable).

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGoBack } from '../navigation/use-go-back';
import { SHEET_DURATION_MS } from '../ui/overlay';

/** The route's screen: no frame of its own, over the tab, appearing at once (the sheet slides). */
export const SHEET_ROUTE_OPTIONS = Object.freeze({
  presentation: 'transparentModal' as const,
  animation: 'none' as const,
  contentStyle: Object.freeze({ backgroundColor: 'transparent' }),
});

type Exit = { readonly kind: 'back' } | { readonly kind: 'replace'; readonly href: string };

const BACK: Exit = Object.freeze({ kind: 'back' });

export type SheetRoute = {
  readonly visible: boolean;
  /** Slide away, then back (Close, the backdrop, Android's back, a decision taken). */
  readonly close: () => void;
  /** Slide away, then this Command Centre screen in the sheet's place. */
  readonly replaceWith: (href: string) => void;
  /** A screen over the sheet (the chat); the sheet comes back when it closes. */
  readonly push: (href: string) => void;
};

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

export function useSheetRoute(fallback: string): SheetRoute {
  const router = useRouter();
  const goBack = useGoBack(fallback);
  const focused = useFocused();
  const [exit, setExit] = useState<Exit | null>(null);

  useEffect(() => {
    if (!exit) return undefined;
    const timer = setTimeout(() => {
      if (exit.kind === 'back') goBack();
      else router.replace(exit.href);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [exit, goBack, router]);

  return useMemo(
    () => ({
      visible: focused && exit === null,
      close: () => setExit((current) => current ?? BACK),
      replaceWith: (href: string) => setExit((current) => current ?? { kind: 'replace', href }),
      push: (href: string) => router.push(href),
    }),
    [focused, exit, router],
  );
}
