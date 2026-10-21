// '● STREAMING LIVE' (handoff §2 top bar): the foundation's one stream status (useLiveStatus, D-LIVE)
// as a dot and a word, the word for every state (chrome.ts liveWord). The dot pulses only while live
// and holds still under Reduce Motion.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useLiveStatus } from '../../api/live';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { LIVE_PULSE, TOP_BAR, liveWord } from './chrome';

const PULSE_EASING = Easing.inOut(Easing.ease);

export function LiveWord() {
  const { colours, radii, spacing } = useTokens();
  const spec = liveWord(useLiveStatus(), useReducedMotion());
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!spec.pulse) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    const half = { duration: LIVE_PULSE.periodMs / 2, easing: PULSE_EASING };
    opacity.value = withRepeat(withTiming(LIVE_PULSE.lowOpacity, half), -1, true);
    return () => cancelAnimation(opacity);
  }, [spec.pulse, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={[
        styles.row,
        { gap: spacing[TOP_BAR.liveGap], paddingRight: spacing[TOP_BAR.liveInset] },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={spec.word}
    >
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colours[spec.dot], borderRadius: radii.full },
          dotStyle,
        ]}
      />
      <Text variant="mono" tone={spec.tone}>
        {spec.word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dot: { width: LIVE_PULSE.dotSize, height: LIVE_PULSE.dotSize },
});
