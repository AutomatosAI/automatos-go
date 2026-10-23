// 'Auto is working…' (the handoff's typing line): italic serif in --muted-foreground, pulsing from
// full to 35 % and back over 1.4 s. Under Reduce Motion it does not pulse (§4.6); the words alone
// say it. Announced politely, so VoiceOver hears it once without moving focus.

import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import { WORKING_PULSE, workingMotion } from '../view-model';

const TEXT_LEVEL = 6;
const HALF_PERIOD_MS = WORKING_PULSE.periodMs / 2;

export function WorkingIndicator() {
  const { pulse } = workingMotion(useReducedMotion());
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(WORKING_PULSE.dimmest, {
        duration: HALF_PERIOD_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [pulse, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={style}
      accessible
      accessibilityLabel={CHAT_COPY.working}
      accessibilityLiveRegion="polite"
    >
      <Text variant="title" level={TEXT_LEVEL} tone="muted" italic>
        {CHAT_COPY.working}
      </Text>
    </Animated.View>
  );
}
