// Whether Candy moves, in React (motion-pause.ts's rule): the style's loops (off under the phone's
// Reduce Motion, which useReduceMotion follows live, and while the look's Motion is 'paused'), the
// look's Motion itself, and the person's pause from the style store, with the toggle
// CandyPauseButton calls. Auto's float and blink, the orb's ring, the writing dots and the voice core
// all read `moving` here, so one tap stops every Candy loop (WCAG 2.2.2).

import { useCallback, useMemo } from 'react';

import { useStyleStore } from '../provider/context';
import { useStyle } from '../theme';
import { CANDY_DEFAULT_LOOK } from './look-schema';
import { candyMotion, type CandyMotionState } from './motion-pause';

export type CandyMotionControl = CandyMotionState & {
  /** Pauses a moving Candy, or plays a paused one; kept on the phone. */
  readonly togglePause: () => void;
};

export function useCandyMotion(): CandyMotionControl {
  const style = useStyle();
  const { loops, reason } = style.motion;
  const lookPaused = (style.candyLook ?? CANDY_DEFAULT_LOOK).motion === 'paused';
  const paused = useStyleStore((state) => state.candyMotionPaused);
  const setPaused = useStyleStore((state) => state.setCandyMotionPaused);
  const togglePause = useCallback(() => {
    setPaused(!paused);
  }, [setPaused, paused]);
  const reduceMotion = reason === 'reduce-motion';
  return useMemo(
    () => ({ ...candyMotion({ loops, reduceMotion, paused, lookPaused }), togglePause }),
    [loops, reduceMotion, paused, lookPaused, togglePause],
  );
}
