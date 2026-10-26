// The keyboard's height while it is up, 0 while it is down: the Sheet's tallest and its bottom
// padding follow it (overlay.ts). Read from React Native's keyboardWillShow / keyboardWillHide,
// which iOS alone sends, so on Android (the window resizes for the keyboard there) it stays 0.

import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** The keyboard's height now: its metrics when it is already up at mount. */
function heightNow(): number {
  return Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0;
}

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(heightNow);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
