// The bottom sheet (the ticket, Deliverable, event and Report this sheets): a Modal over a backdrop
// that fades in while the sheet slides up 220 ms (react-native-reanimated); a tap on the backdrop,
// Android's back and VoiceOver's escape gesture close it. Under Reduce Motion it does not slide, it
// fades in place. 14 pt top radius, a grabber, the content scrolls and the keyboard pushes it up;
// with the keyboard up a tall sheet is no taller than the room above it (sheetMaxHeight), so its
// top stays on screen, and the home indicator's inset is no longer a gap over the keyboard.
// The sheet stays mounted while it animates out; the logic is in overlay.ts (pure, tested). A5: the
// dress gives the top radius (14 Studio, 14 Play, 0 HUD) and the grabber's (HUD's square).

import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDress } from '../styles/dress/use-dress';
import { useTokens } from '../styles/theme';
import {
  GRABBER,
  SHEET_EASING,
  backdropColour,
  sheetBottomPadding,
  sheetMaxHeight,
  sheetMotion,
  sheetOffset,
  sheetOpacity,
} from './overlay';
import { UI_COPY } from './strings';
import { useKeyboardHeight } from './use-keyboard-height';

const EASING = Easing.bezier(...SHEET_EASING);
const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;

export type SheetProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

export function Sheet({ visible, onClose, children }: SheetProps) {
  const { colours, spacing, scheme } = useTokens();
  const { sheetRadius, grabberRadius } = useDress();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const { slide, durationMs } = sheetMotion(useReducedMotion());
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const height = useSharedValue(windowHeight);

  useEffect(() => {
    progress.value = withTiming(
      visible ? 1 : 0,
      { duration: durationMs, easing: EASING },
      (finished) => {
        if (finished && !visible) runOnJS(setMounted)(false);
      },
    );
  }, [visible, durationMs, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity(progress.value, slide),
    transform: [{ translateY: sheetOffset(progress.value, height.value, slide) }],
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    height.value = event.nativeEvent.layout.height;
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: backdropColour(colours, scheme) },
          backdropStyle,
        ]}
      >
        <Pressable
          style={styles.fill}
          onPress={onClose}
          disabled={!visible}
          accessibilityRole="button"
          accessibilityLabel={UI_COPY.closeSheet}
          accessibilityState={{ disabled: !visible }}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOUR}
        style={styles.dock}
        pointerEvents="box-none"
      >
        <Animated.View
          onLayout={onLayout}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight(windowHeight, keyboard, insets.top),
              backgroundColor: colours.background,
              borderColor: colours.border,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
            },
            sheetStyle,
          ]}
        >
          <View
            style={[
              styles.grabberRow,
              { paddingTop: spacing.space3, paddingBottom: spacing.space1 },
            ]}
          >
            <View
              style={[
                styles.grabber,
                { backgroundColor: colours.muted, borderRadius: grabberRadius },
              ]}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: spacing.space5,
              paddingTop: spacing.space3,
              paddingHorizontal: spacing.space9,
              paddingBottom: sheetBottomPadding(spacing.space7, insets.bottom, keyboard),
            }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopWidth: 1, overflow: 'hidden' },
  grabberRow: { alignItems: 'center' },
  grabber: { width: GRABBER.width, height: GRABBER.height },
});
