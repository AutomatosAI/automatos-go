// The core's loops on reanimated: a progress 0 → 1 over durationMs, forever (there and back when
// alternate), after an optional delay; held at rest while loops may not run (Reduce Motion, HUD's
// motion off), so every ring, bar and cursor stands still with its text twin beside it.

import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated';

const FOREVER = -1;

export type LoopOptions = {
  /** 0 → 1 → 0 (CSS's alternate) rather than 0 → 1, 0 → 1. */
  readonly alternate?: boolean;
  readonly delayMs?: number;
  /** Linear when omitted (CSS's 'linear' spins). */
  readonly easing?: EasingFunction | EasingFunctionFactory;
  /** Where the progress rests while still: 0, or 1 (a bar at its full height). */
  readonly rest?: 0 | 1;
};

export function useLoop(
  animate: boolean,
  durationMs: number,
  options: LoopOptions = {},
): SharedValue<number> {
  const { alternate = false, delayMs = 0, easing = Easing.linear, rest = 0 } = options;
  const progress = useSharedValue<number>(rest);
  useEffect(() => {
    progress.set(animate ? 0 : rest);
    if (!animate) return undefined;
    const loop = withRepeat(withTiming(1, { duration: durationMs, easing }), FOREVER, alternate);
    progress.set(delayMs > 0 ? withDelay(delayMs, loop) : loop);
    return () => cancelAnimation(progress);
  }, [animate, durationMs, alternate, delayMs, easing, rest, progress]);
  return progress;
}
