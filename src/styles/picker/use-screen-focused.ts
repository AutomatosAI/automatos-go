// Whether the screen this hook is in is the one on top: true while it is focused, false once
// another screen is pushed over it or it is left. The picker's previews move only while it is
// true (cards.ts previewAnimates), so nothing loops behind a look page.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
