// Back: the screen before this one, or the fallback (home) when the screen was opened first (a link
// or a notification), so a back button never leaves the person stranded on an empty stack. The
// rule is back.ts (pure, tested); this hook only asks the router whether a screen is behind and
// where the person is, and does what the rule says: nothing at all when it says stay. useBack also
// hands over the move as it stands, for the Header to draw no way back where pressing would do
// nothing.
//
// The press keeps one identity for as long as the router and the fallback do, whatever path the
// person moves to: callers keep it in an effect's dependencies (a sheet route leaves through it
// after its slide, use-sheet-route.ts), and a new function on every path change would run that
// effect again. So the press reads where the person is when it is pressed, from a ref the layout
// effect keeps current, never from its own dependencies.

import { usePathname, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';

import { backMove, type BackMove } from './back';
import { routes } from './routes';

export type Back = Readonly<{
  /** The move a press would make now (the Header draws no way back when it is stay). */
  move: BackMove;
  /** The press: asks the router again, then goes back, puts the fallback here, or does nothing. */
  goBack: () => void;
}>;

/** Where the person is, as the press reads it when it is pressed. */
type Place = Readonly<{ here: string; root: boolean }>;

export function useBack(fallback: string = routes.home, root: boolean = false): Back {
  const router = useRouter();
  const here = usePathname();
  const place = useRef<Place>({ here, root });
  useLayoutEffect(() => {
    place.current = { here, root };
  }, [here, root]);
  const goBack = useCallback(() => {
    const move = backMove({ canGoBack: router.canGoBack(), fallback, ...place.current });
    if (move.kind === 'back') router.back();
    else if (move.kind === 'replace') router.replace(move.href);
  }, [router, fallback]);
  const move = backMove({ canGoBack: router.canGoBack(), fallback, here, root });
  return Object.freeze({ move, goBack });
}

export function useGoBack(fallback: string = routes.home): () => void {
  return useBack(fallback).goBack;
}
