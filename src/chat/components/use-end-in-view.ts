// A thread list's end, for any FlatList of a thread: Studio's MessageList, Play's PlayThread and
// Candy's ChatView (../end-in-view.ts has the rules). The list scrolls to its end when a row is
// added (shouldScrollToEnd), never as a reply grows; the scroll waits for the new content's size,
// and it is not animated under Reduce Motion. When the list's view shrinks under someone at its end
// (the keyboard coming up), it scrolls back to the end, not animated (the keyboard is already
// moving). Either way it scrolls to the content's foot by offset: FlatList's scrollToEnd stops at
// the last row, short of the thread's bottom padding. It reads where the list is from its scrolls,
// content size and layout. Spread the result on the FlatList; `afterContent` runs on each content
// size change after the jump to the end (the focus scroll, so a thread opened at a message stays
// there).

import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { NO_METRICS, endMetrics, keepsEndInView, type ListMetrics } from '../end-in-view';
import { shouldScrollToEnd } from '../view-model';

/** A scroll event a frame, so the offset is current when the keyboard comes up. */
const SCROLL_THROTTLE_MS = 16;

export type EndInViewProps = {
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly onContentSizeChange: (width: number, height: number) => void;
  readonly scrollEventThrottle: number;
};

/** Marks a scroll when a row is added; the next content size change carries it out. */
function usePendingOnAdd(count: number) {
  const previous = useRef(count);
  const pending = useRef(false);
  // a layout effect: it runs before the new content reports its size
  useLayoutEffect(() => {
    if (shouldScrollToEnd(previous.current, count)) pending.current = true;
    previous.current = count;
  }, [count]);
  return pending;
}

export function useEndInView<Row>(
  list: RefObject<FlatList<Row> | null>,
  rowCount: number,
  afterContent: () => void,
): EndInViewProps {
  const animated = !useReducedMotion();
  const metrics = useRef<ListMetrics>(NO_METRICS);
  const pending = usePendingOnAdd(rowCount);
  // at the end at once: the keyboard can shrink the list again before this scroll is reported
  const toFoot = useCallback(
    (animate: boolean) => {
      const { content, view } = metrics.current;
      if (view === 0) {
        list.current?.scrollToEnd({ animated: animate });
        return;
      }
      metrics.current = endMetrics(content, view);
      list.current?.scrollToOffset({ offset: metrics.current.offset, animated: animate });
    },
    [list],
  );
  // the view's height only from layout: a scroll landing between the shrink and its layout event
  // would otherwise hide the shrink
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize } = event.nativeEvent;
    metrics.current = { ...metrics.current, offset: contentOffset.y, content: contentSize.height };
  }, []);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const view = event.nativeEvent.layout.height;
      const keep = keepsEndInView(metrics.current, view);
      metrics.current = { ...metrics.current, view };
      if (!keep) return;
      toFoot(false);
      // and again a frame on: the layout event can come before the native list takes its new
      // height, and Android then clamps the scroll to the old end (the message box growing a line)
      requestAnimationFrame(() => toFoot(false));
    },
    [toFoot],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      metrics.current = { ...metrics.current, content: height };
      if (pending.current) {
        pending.current = false;
        toFoot(animated);
      }
      afterContent();
    },
    [pending, toFoot, animated, afterContent],
  );
  return { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: SCROLL_THROTTLE_MS };
}
