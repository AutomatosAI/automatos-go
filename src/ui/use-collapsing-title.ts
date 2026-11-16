// The collapsing title (the app standard's rule 4.2): a screen with a large title at the top of
// its scrolling content hands the Header `collapsing`, and the bar's own title appears once the
// large one has scrolled away. The screen gives onTitleLayout to the view that holds its large
// title, placed straight in the scroll content (its layout is then measured against the content),
// and onScroll to its scroll view, with scrollEventThrottle at SCROLL_EVENT_THROTTLE_MS. What
// counts as gone is header-model.ts's (largeTitleEnd, largeTitleGone); this hook only keeps where the
// title ends and where the content is.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { largeTitleEnd, largeTitleGone, type CollapsingTitle } from './header-model';

export type CollapsingTitleHandlers = Readonly<{
  /** What the Header takes as `collapsing`. */
  collapsing: CollapsingTitle;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTitleLayout: (event: LayoutChangeEvent) => void;
}>;

export function useCollapsingTitle(): CollapsingTitleHandlers {
  const titleEnd = useRef<number | null>(null);
  const offsetY = useRef(0);
  const [gone, setGone] = useState(false);
  const onTitleLayout = useCallback((event: LayoutChangeEvent) => {
    titleEnd.current = largeTitleEnd(event.nativeEvent.layout);
    setGone(largeTitleGone(offsetY.current, titleEnd.current));
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = event.nativeEvent.contentOffset.y;
    setGone(largeTitleGone(offsetY.current, titleEnd.current));
  }, []);
  const collapsing = useMemo(() => Object.freeze({ gone }), [gone]);
  return useMemo(
    () => Object.freeze({ collapsing, onScroll, onTitleLayout }),
    [collapsing, onScroll, onTitleLayout],
  );
}
