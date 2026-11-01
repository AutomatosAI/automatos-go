// A thread list that keeps its end in view when its view shrinks (../end-in-view.ts has the rule),
// for any FlatList of a thread: Studio's MessageList, Play's PlayThread and Candy's ChatView. It
// reads where the list was from its scrolls, content size and layout, and on a smaller layout
// scrolls to the content's foot, not animated (the keyboard is already moving). Spread the result
// on the FlatList; the list's own content size handler goes in and runs after the content height is
// noted.

import { useCallback, useRef, type RefObject } from 'react';
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { NO_METRICS, endMetrics, keepsEndInView, type ListMetrics } from '../end-in-view';

/** A scroll event a frame, so the offset is current when the keyboard comes up. */
const SCROLL_THROTTLE_MS = 16;

export type EndInViewProps = {
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly onContentSizeChange: (width: number, height: number) => void;
  readonly scrollEventThrottle: number;
};

export function useEndInView<Row>(
  list: RefObject<FlatList<Row> | null>,
  onContentSizeChange: () => void,
): EndInViewProps {
  const metrics = useRef<ListMetrics>(NO_METRICS);
  // the view's height only from layout: a scroll landing between the shrink and its layout event
  // would otherwise hide the shrink
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    metrics.current = { ...metrics.current, offset: contentOffset.y, content: contentSize.height };
  }, []);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const view = event.nativeEvent.layout.height;
      const before = metrics.current;
      if (!keepsEndInView(before, view)) {
        metrics.current = { ...before, view };
        return;
      }
      // at the end at once: the keyboard can shrink the list again before this scroll is reported
      metrics.current = endMetrics(before.content, view);
      // to the content's foot: FlatList's scrollToEnd stops at the last row, short of the padding
      list.current?.scrollToOffset({ offset: metrics.current.offset, animated: false });
    },
    [list],
  );
  const onContent = useCallback(
    (_width: number, height: number) => {
      metrics.current = { ...metrics.current, content: height };
      onContentSizeChange();
    },
    [onContentSizeChange],
  );
  return {
    onScroll,
    onLayout,
    onContentSizeChange: onContent,
    scrollEventThrottle: SCROLL_THROTTLE_MS,
  };
}
