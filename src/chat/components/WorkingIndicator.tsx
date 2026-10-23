// 'Thinking' (D72, as the web's chat shows it while Auto works): three 6 pt dots in the muted ink,
// each pulsing from full to 35 % and back over 1.4 s, one after another, then the word. Where it
// starts Auto's run it is a pill painted like Auto's box, in Auto's slot beside the sail, so the
// answer lands in the same place; under Auto's tool lines it is the dots and the word with no box
// (one box per thing, thread-look.ts thinkingStyle). Under Reduce Motion the dots hold still
// (§4.6); the word alone says it. Screen readers hear 'Auto is thinking' once, without moving
// focus: a polite live region on Android, an announcement on iOS (which has no live regions).

import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import { WORKING_PULSE, workingMotion } from '../view-model';
import { THINKING_LABEL, THREAD, thinkingStyle } from './thread-look';

const HALF_PERIOD_MS = WORKING_PULSE.periodMs / 2;
const DOT_INDEXES: readonly number[] = Array.from({ length: THREAD.dots.count }, (_, i) => i);

function ThinkingDot({ index, pulse }: { readonly index: number; readonly pulse: boolean }) {
  const { colours, radii } = useTokens();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(
      index * THREAD.dots.staggerMs,
      withRepeat(
        withTiming(WORKING_PULSE.dimmest, {
          duration: HALF_PERIOD_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [index, pulse, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: THREAD.dots.size,
          height: THREAD.dots.size,
          borderRadius: radii.full,
          backgroundColor: colours.mutedForeground,
        },
        fade,
      ]}
    />
  );
}

export type WorkingIndicatorProps = {
  /** A pill like Auto's box where it starts Auto's run; the dots and the word alone under it. */
  readonly boxed: boolean;
};

/** iOS ignores accessibilityLiveRegion, so VoiceOver is told once, when the pill appears. */
function useAnnounceOnIos(words: string) {
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(words);
  }, [words]);
}

export function WorkingIndicator({ boxed }: WorkingIndicatorProps) {
  const tokens = useTokens();
  const { pulse } = workingMotion(useReducedMotion());
  useAnnounceOnIos(CHAT_COPY.thinkingLabel);
  return (
    <View
      accessible
      accessibilityLabel={CHAT_COPY.thinkingLabel}
      accessibilityLiveRegion="polite"
      style={thinkingStyle(tokens, boxed)}
    >
      <View style={{ flexDirection: 'row', gap: tokens.spacing.space1 }}>
        {DOT_INDEXES.map((index) => (
          <ThinkingDot key={index} index={index} pulse={pulse} />
        ))}
      </View>
      <Text level={THINKING_LABEL.level} tone="muted" weight={THINKING_LABEL.weight}>
        {CHAT_COPY.thinking}
      </Text>
    </View>
  );
}
