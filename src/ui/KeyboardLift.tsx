// A scrolling screen's lift over the keyboard on Android (#50): the sign-in, Connect and Questions
// screens. On iOS their scroll view's automaticallyAdjustKeyboardInsets insets it by the keyboard
// and scrolls the focused field into view, so this draws its children as they are. Android has no
// such inset, and its window does not resize for the keyboard (React Native 0.81 draws edge to
// edge), so here the lift pads its own bottom by what the keyboard covers of it, measured on screen
// when the keyboard comes up (keyboardOverlap): a KeyboardAvoidingView measures from its parent,
// which under the Command Centre's bars is not the screen's top. Android's scroll view then keeps
// the focused field on screen as it shrinks (ScrollView.onSizeChanged), as a resized window would.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';

import { keyboardOverlap } from './overlay';

export type KeyboardLiftProps = {
  readonly children: ReactNode;
};

const ANDROID = Platform.OS === 'android';

/** The keyboard's top on screen while it is up; null while it is down. */
function keyboardTopNow(): number | null {
  return Keyboard.isVisible() ? (Keyboard.metrics()?.screenY ?? null) : null;
}

/**
 * On Android, the bottom padding that keeps the lift's content above the keyboard; 0 elsewhere.
 * measure()'s pageY counts from the screen's top, as the keyboard's screenY does (measureInWindow's
 * y counts from under the status bar). It is read when the keyboard comes up, at mount (a keyboard
 * already up: Android tells nothing more until it hides) and on each layout while it is up.
 */
function useLift(view: { readonly current: View | null }) {
  const [lift, setLift] = useState(0);
  const measure = useCallback(
    (keyboardTop: number | null) => {
      if (keyboardTop === null) return setLift(0);
      view.current?.measure((_x, _y, _width, height, _pageX, pageY) =>
        setLift(keyboardOverlap(pageY + height, keyboardTop)),
      );
    },
    [view],
  );
  useEffect(() => {
    if (!ANDROID) return undefined;
    measure(keyboardTopNow());
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      measure(event.endCoordinates.screenY),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setLift(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [measure]);
  const onLayout = useCallback(() => {
    if (ANDROID) measure(keyboardTopNow());
  }, [measure]);
  return { lift, onLayout };
}

export function KeyboardLift({ children }: KeyboardLiftProps) {
  const view = useRef<View>(null);
  const { lift, onLayout } = useLift(view);
  return (
    <View ref={view} onLayout={onLayout} style={[styles.fill, { paddingBottom: lift }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
