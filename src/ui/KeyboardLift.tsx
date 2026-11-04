// A scrolling screen's lift over the keyboard on Android (#50): the sign-in, Connect and Questions
// screens. On iOS their scroll view's automaticallyAdjustKeyboardInsets insets it by the keyboard
// and scrolls the focused field into view, so this draws its children as they are. Android has no
// such inset, and its window does not resize for the keyboard (React Native 0.81 draws edge to
// edge), so here the lift pads its own bottom by what the keyboard covers of it, measured on screen
// when the keyboard comes up (keyboardOverlap): a KeyboardAvoidingView measures from its parent,
// which under the Command Centre's bars is not the screen's top. Android's scroll view then keeps
// the focused field on screen as it shrinks (ScrollView.onSizeChanged), as a resized window would.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StatusBar, StyleSheet, View } from 'react-native';

import { keyboardOverlap } from './overlay';

export type KeyboardLiftProps = {
  readonly children: ReactNode;
};

/** On Android, the bottom padding that keeps the lift's content above the keyboard; 0 elsewhere. */
function useLift(view: { readonly current: View | null }): number {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      // measureInWindow counts from under the status bar, the keyboard's screenY from the
      // screen's top (the app draws edge to edge): the status bar's height puts both on screen
      const top = StatusBar.currentHeight ?? 0;
      view.current?.measureInWindow((_x, y, _width, height) =>
        setLift(keyboardOverlap(top + y + height, event.endCoordinates.screenY)),
      );
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setLift(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [view]);
  return lift;
}

export function KeyboardLift({ children }: KeyboardLiftProps) {
  const view = useRef<View>(null);
  const lift = useLift(view);
  return (
    <View ref={view} style={[styles.fill, { paddingBottom: lift }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
