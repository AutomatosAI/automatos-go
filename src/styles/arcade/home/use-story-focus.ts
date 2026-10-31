// Arcade's story scrolled to its focus message once (PRD-268 US-G03; the rules are story-focus.ts's),
// as use-focus-scroll.ts does for a FlatList. Each entry reports its layout (onPlaced); the scroll
// runs on the next frame when the focus's entry is laid out, when a focus arrives over entries
// already laid out, and from the story's content size change (call `run` there after the
// scroll-on-add, so the focus wins over the jump to the end). It is not animated: it is where the
// story opens. The reply the dialogue says settles without a scroll. `onFocused` hears the message
// once, scrolled to or settled.

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { LayoutRectangle, ScrollView } from 'react-native';

import { shouldFocus } from '../../../chat/focus';
import { storyFocusIndex, storyFocusStep, withPlace, type StoryPlaces } from './story-focus';

export type StoryFocus = {
  /** Scrolls to the focus's entry if it is laid out and not handled yet (onContentSizeChange). */
  readonly run: () => void;
  /** An entry's onLayout: its top in the story's content. */
  readonly onPlaced: (key: string, layout: LayoutRectangle) => void;
};

export type StoryFocusInput = {
  readonly entries: readonly { readonly key: string }[];
  readonly focus: string | null;
  /** The message the dialogue window says: settled, never scrolled to. */
  readonly sayingId: string | null;
  readonly onFocused?: (messageId: string) => void;
};

/** One frame callback at a time, cancelled when the story goes. */
function useNextFrame(): (run: () => void) => void {
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return useCallback((run: () => void) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      run();
    });
  }, []);
}

export function useStoryFocus(
  scroller: RefObject<ScrollView | null>,
  { entries, focus, sayingId, onFocused }: StoryFocusInput,
): StoryFocus {
  // every id handled, so a route's focus never pulls the story back after a later one
  const done = useRef<ReadonlySet<string>>(new Set());
  const places = useRef<StoryPlaces>(new Map());
  const index = storyFocusIndex(entries, focus);
  const run = useCallback(() => {
    const facts = { focus, done: done.current, index, sayingId, places: places.current };
    const step = storyFocusStep(facts);
    if (step.kind === 'wait') return;
    done.current = new Set([...done.current, step.messageId]);
    if (step.kind === 'scroll') scroller.current?.scrollTo({ y: step.y, animated: false });
    onFocused?.(step.messageId);
  }, [scroller, focus, index, sayingId, onFocused]);
  const latest = useRef({ run, focus });
  useLayoutEffect(() => {
    latest.current = { run, focus };
  });
  const nextFrame = useNextFrame();
  // a focus over entries already laid out, or the dialogue's reply: no layout will come
  useEffect(() => {
    if (shouldFocus(focus, done.current, index)) nextFrame(run);
  }, [focus, index, run, nextFrame]);
  const onPlaced = useCallback(
    (key: string, layout: LayoutRectangle) => {
      places.current = withPlace(places.current, key, layout);
      if (key === latest.current.focus) nextFrame(() => latest.current.run());
    },
    [nextFrame],
  );
  return { run, onPlaced };
}
