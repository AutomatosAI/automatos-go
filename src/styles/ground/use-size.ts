// A view's own size, from its onLayout: the grounds draw to the screen they fill. Null until the
// first layout, and kept when a layout reports the same size (no redraw on every pass).

import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { Size } from './spots';

export function useLayoutSize(): readonly [Size | null, (event: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<Size | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((now) => (now && now.width === width && now.height === height ? now : { width, height }));
  }, []);
  return [size, onLayout] as const;
}
