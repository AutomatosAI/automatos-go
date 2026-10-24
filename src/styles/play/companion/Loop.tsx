// The Companion's two loops, each with a still twin: the running tool chip's spinner (a turn every
// COMPANION.chip.spinMs) and the streaming caret's blink. While loops may not run (Reduce Motion)
// the spinner rests with its accent top up and the caret stays lit; the words beside each say
// what it shows.

import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { COMPANION } from './model';

const FOREVER = -1;
const FULL_TURN = 360;

/** 0 → 1 over durationMs while animate is true (there and back when reverse), else 0. */
function useLoopProgress(animate: boolean, durationMs: number, reverse: boolean) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    if (!animate) return undefined;
    const easing = reverse ? Easing.inOut(Easing.ease) : Easing.linear;
    progress.set(withRepeat(withTiming(1, { duration: durationMs, easing }), FOREVER, reverse));
    return () => cancelAnimation(progress);
  }, [animate, durationMs, reverse, progress]);
  return progress;
}

type LoopProps = {
  readonly animate: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

/** Turns its child once per COMPANION.chip.spinMs. */
export function Spin({ animate, style, children }: LoopProps) {
  const progress = useLoopProgress(animate, COMPANION.chip.spinMs, false);
  const turn = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.get() * FULL_TURN}deg` }],
  }));
  return <Animated.View style={[style, turn]}>{children}</Animated.View>;
}

/** Fades its child out and back in over COMPANION.caret.blinkMs each way. */
export function Blink({ animate, style, children }: LoopProps) {
  const progress = useLoopProgress(animate, COMPANION.caret.blinkMs, true);
  const blink = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  return <Animated.View style={[style, blink]}>{children}</Animated.View>;
}
