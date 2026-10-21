// A toast: the short confirmation after an action ('Answered — the agent is resuming.'). On iOS a
// card at the top with the success tick, on Android the ink snackbar at the bottom (the handoff).
// It takes no touches and fades in and out (Reanimated follows Reduce Motion). ToastProvider owns
// the timing (2.4 s) and the announcement; this file only paints one (overlay.ts: TOAST_LOOKS).

import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CircleCheck from 'lucide-react-native/icons/circle-check';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { TOAST_LOOKS, type ToastPlacement } from './overlay';
import { ICON_STROKE } from './paint';
import { BUTTON_LABEL_WEIGHT } from './variants';

const ICON_SIZE = 18;

export type ToastProps = {
  readonly message: string;
  readonly placement: ToastPlacement;
};

export function Toast({ message, placement }: ToastProps) {
  const { colours, radii, spacing, shadows } = useTokens();
  const insets = useSafeAreaInsets();
  const look = TOAST_LOOKS[placement];
  const edge =
    placement === 'top'
      ? { top: insets.top + spacing[look.edgeInset] }
      : { bottom: insets.bottom + spacing[look.edgeInset] };
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        edge,
        {
          left: spacing[look.sideInset],
          right: spacing[look.sideInset],
          gap: spacing.space4,
          paddingHorizontal: spacing[look.paddingX],
          paddingVertical: spacing[look.paddingY],
          borderRadius: radii[look.radius],
          backgroundColor: colours[look.background],
          borderColor: look.border ? colours[look.border] : 'transparent',
          boxShadow: shadows.toast,
        },
      ]}
    >
      {look.icon ? (
        <View importantForAccessibility="no-hide-descendants">
          <CircleCheck size={ICON_SIZE} color={colours.success} strokeWidth={ICON_STROKE} />
        </View>
      ) : null}
      <Text level={look.level} weight={BUTTON_LABEL_WEIGHT} tone={look.tone} style={styles.words}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  words: { flex: 1 },
});
