// Back: the screen before this one, or the fallback (home) when the screen was opened first (a link
// or a notification), so a back button never leaves the person stranded on an empty stack.

import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { routes } from './routes';

export function useGoBack(fallback: string = routes.home): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
