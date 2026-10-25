// A preview's one loop: its child breathes between two scales over PREVIEW.pulseMs (Ember's ring
// pulse, HUD's pulse disc) while animate is true, and rests at the first scale the moment it is
// false (the screen left, Reduce Motion, HUD's motion off).

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

import { PREVIEW } from './cards';

/** There and back is one loop. */
const HALF_LOOP_MS = PREVIEW.pulseMs / 2;
const FOREVER = -1;

type PreviewPulseProps = {
  readonly animate: boolean;
  readonly from: number;
  readonly to: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

export function PreviewPulse({ animate, from, to, style, children }: PreviewPulseProps) {
  const scale = useSharedValue(from);

  useEffect(() => {
    scale.set(from);
    if (!animate) return undefined;
    scale.set(
      withRepeat(
        withTiming(to, { duration: HALF_LOOP_MS, easing: Easing.inOut(Easing.ease) }),
        FOREVER,
        true,
      ),
    );
    return () => cancelAnimation(scale);
  }, [animate, from, to, scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[style, pulse]}>{children}</Animated.View>;
}
