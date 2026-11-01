// The keyboard's height while it is up, 0 while it is down: the Sheet's tallest and its bottom
// padding follow it (overlay.ts). iOS sends keyboardWillShow / keyboardWillHide; Android sends only
// keyboardDidShow / keyboardDidHide, and its window does not resize for the keyboard: the app draws
// edge to edge (React Native 0.81, edgeToEdgeEnabled), so the Sheet moves itself there too
// (docs/android-spike.md, "The keyboard").

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How every KeyboardAvoidingView in the app moves for the keyboard, on both platforms: Android's
 * window doesn't resize for the keyboard while the app draws edge to edge, so padding is needed
 * there as on iOS.
 */
export const KEYBOARD_AVOIDING_BEHAVIOUR = 'padding';

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** The keyboard's height now: its metrics when it is already up at mount. */
function heightNow(): number {
  return Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0;
}

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(heightNow);
  useEffect(() => {
    const shown = Keyboard.addListener(SHOW, (event) => setHeight(event.endCoordinates.height));
    const hidden = Keyboard.addListener(HIDE, () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
