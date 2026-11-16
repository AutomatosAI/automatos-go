// Back: the screen before this one, or the fallback (home) when the screen was opened first (a link
// or a notification), so a back button never leaves the person stranded on an empty stack. The
// rule is back.ts (pure, tested); this hook only asks the router and does what the rule says.

import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { backMove } from './back';
import { routes } from './routes';

export function useGoBack(fallback: string = routes.home): () => void {
  const router = useRouter();
  return useCallback(() => {
    const move = backMove(router.canGoBack(), fallback);
    if (move.kind === 'back') router.back();
    else router.replace(move.href);
  }, [router, fallback]);
}
