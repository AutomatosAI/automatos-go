// Whether Arcade moves, in React (motion-pause.ts's rule): the style's loops (off under the phone's
// Reduce Motion, which useReduceMotion follows live) and the person's pause from the style store,
// with the toggle the pause control calls. The sprite, the ▶ / ▼ cursor and the typed line all read
// `moving` here, so one tap stops every loop (WCAG 2.2.2).

import { useCallback, useMemo } from 'react';

import { useStyleStore } from '../provider/context';
import { useStyle } from '../theme';
import { arcadeMotion, type ArcadeMotion } from './motion-pause';

export type ArcadeMotionControl = ArcadeMotion & {
  /** Pauses a moving Arcade, or plays a paused one; kept on the phone. */
  readonly togglePause: () => void;
};

export function useArcadeMotion(): ArcadeMotionControl {
  const { loops } = useStyle().motion;
  const paused = useStyleStore((state) => state.arcadeMotionPaused);
  const setPaused = useStyleStore((state) => state.setArcadeMotionPaused);
  const togglePause = useCallback(() => {
    setPaused(!paused);
  }, [setPaused, paused]);
  return useMemo(
    () => ({ ...arcadeMotion(loops, paused), togglePause }),
    [loops, paused, togglePause],
  );
}
