// A thread list scrolled to its focus message once (PRD-268 US-G03; the rules are ../focus.ts's), for
// any FlatList of the view-model's rows: Studio's MessageList and Play's PlayThread. The scroll runs
// when the focus row is drawn, on the next frame, and again from the list's content size change
// (call `run` there after the scroll-on-add, so the focus wins over the jump to the end); it is not
// animated (it is where the thread opens). A row FlatList has not laid out yet is jumped near at
// the average row height and tried again a few times. `onFocused` hears the message once scrolled.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FlatList } from 'react-native';

import { FOCUS_RETRIES, approximateOffset, focusIndex, shouldFocus } from '../focus';

/** A frame for FlatList to lay the rows out before the next try. */
const RETRY_MS = 60;
/** The row's top at the list's top. */
const TOP = 0;

type ScrollFailure = { readonly index: number; readonly averageItemLength: number };

export type FocusScroll = {
  /** Scrolls to the focus row if it is drawn and not scrolled to yet (onContentSizeChange). */
  readonly run: () => void;
  readonly onScrollToIndexFailed: (info: ScrollFailure) => void;
};

export function useFocusScroll<Row extends { readonly key: string }>(
  list: RefObject<FlatList<Row> | null>,
  rows: readonly Row[],
  focus: string | null,
  onFocused?: (messageId: string) => void,
): FocusScroll {
  const done = useRef<string | null>(null);
  const retries = useRef(0);
  const index = focus === null ? -1 : focusIndex(rows, focus);
  const run = useCallback(() => {
    if (focus === null || !shouldFocus(focus, done.current, index)) return;
    done.current = focus;
    retries.current = 0;
    list.current?.scrollToIndex({ index, animated: false, viewPosition: TOP });
    onFocused?.(focus);
  }, [list, focus, index, onFocused]);
  // a focus that arrives over rows already drawn: no content size change will come
  useEffect(() => {
    if (!shouldFocus(focus, done.current, index)) return undefined;
    const frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [focus, index, run]);
  const onScrollToIndexFailed = useCallback(
    (info: ScrollFailure) => {
      list.current?.scrollToOffset({ offset: approximateOffset(info), animated: false });
      if (retries.current >= FOCUS_RETRIES) return;
      retries.current += 1;
      setTimeout(
        () =>
          list.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: TOP }),
        RETRY_MS,
      );
    },
    [list],
  );
  return { run, onScrollToIndexFailed };
}
