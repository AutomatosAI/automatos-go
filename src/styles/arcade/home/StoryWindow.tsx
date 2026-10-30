// Arcade's story window (README 'Pages' /chat; the design kit's chat/story.tsx and the 'Phone 390'
// log): an Arcade window tabbed STORY over the conversation, oldest first, opening with the AI label
// (D-AI-LABEL: A2's untouched AiLabel, its first row, scrolling away with it; the window's scanlines
// sit behind its content, never over it). Each entry is StoryEntry's. It scrolls to the end when an
// entry is added (A2's shouldScrollToEnd), never as one grows, and not animated under Reduce
// Motion. The window takes the room the home leaves it, and keeps at least a share of the screen.

import { useCallback, useLayoutEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { shouldScrollToEnd } from '../../../chat/view-model';
import { AiLabel } from '../../ai-label';
import { ARCADE_HOME_COPY } from '../../strings';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { StoryEntryRow, type StoryEntryProps } from './StoryEntry';

/** The window's padding and the room between entries; its least height as a share of the screen. */
const STORY = Object.freeze({ pad: 12, gap: 14, minShare: 0.28 });

/** Marks a scroll when an entry is added; the next content size change carries it out. */
function useScrollOnAdd(count: number) {
  const scroller = useRef<ScrollView>(null);
  const animated = !useReducedMotion();
  const previous = useRef(0);
  const pending = useRef(false);
  useLayoutEffect(() => {
    if (shouldScrollToEnd(previous.current, count)) pending.current = true;
    previous.current = count;
  }, [count]);
  const onContentSizeChange = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    scroller.current?.scrollToEnd({ animated });
  }, [animated]);
  return { scroller, onContentSizeChange };
}

export type StoryWindowProps = Omit<StoryEntryProps, 'entry'> & {
  readonly entries: readonly StoryEntryProps['entry'][];
};

export function StoryWindow({ entries, ...shared }: StoryWindowProps) {
  const { height } = useWindowDimensions();
  const { scroller, onContentSizeChange } = useScrollOnAdd(entries.length);
  return (
    <ArcadeWindow
      title={ARCADE_HOME_COPY.story}
      fill
      style={[styles.window, { minHeight: height * STORY.minShare }]}
    >
      <ScrollView
        ref={scroller}
        accessibilityLabel={ARCADE_HOME_COPY.storyLabel}
        onContentSizeChange={onContentSizeChange}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      >
        <View style={styles.caption}>
          <AiLabel />
        </View>
        {entries.map((entry) => (
          <StoryEntryRow key={entry.key} entry={entry} {...shared} />
        ))}
      </ScrollView>
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  window: { flex: 1 },
  list: { padding: STORY.pad, gap: STORY.gap },
  caption: { alignItems: 'center' },
});
