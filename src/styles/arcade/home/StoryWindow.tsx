// Arcade's story window (README 'Pages' /chat; the design kit's chat/story.tsx and the 'Phone 390'
// log): an Arcade window tabbed STORY over the conversation, oldest first, opening with the AI label
// (D-AI-LABEL: A2's untouched AiLabel, its first row, scrolling away with it; the window's scanlines
// sit behind its content, never over it). Each entry is StoryEntry's. It scrolls to the end when an
// entry is added (A2's shouldScrollToEnd), never as one grows, and not animated under Reduce
// Motion. Given a focus message (PRD-268 US-G03, the Auto thread opened at the day's brief), it
// scrolls there once instead, its entry's top at the window's top (use-story-focus.ts; the reply the
// dialogue window says settles without a scroll). The window takes the room the home leaves it,
// and keeps at least a share of the screen.

import { useCallback, useLayoutEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { shouldScrollToEnd } from '../../../chat/view-model';
import { AiLabel } from '../../ai-label';
import { ARCADE_HOME_COPY } from '../../strings';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { StoryEntryRow, type StoryEntryProps } from './StoryEntry';
import { useStoryFocus } from './use-story-focus';

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
  const scrollOnAdd = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    scroller.current?.scrollToEnd({ animated });
  }, [animated]);
  return { scroller, scrollOnAdd };
}

export type StoryWindowProps = Omit<StoryEntryProps, 'entry'> & {
  readonly entries: readonly StoryEntryProps['entry'][];
  /** The message the story opens at, scrolled to once (PRD-268 US-G03, use-thread-focus.ts). */
  readonly focusMessageId?: string | null;
  /** The story scrolled to the focus message, or the dialogue says it. */
  readonly onFocused?: (messageId: string) => void;
  /** The message the dialogue window says (useArcadeStory's saying): a focus there never scrolls. */
  readonly sayingId?: string | null;
};

export function StoryWindow(props: StoryWindowProps) {
  const { entries, focusMessageId = null, onFocused, sayingId = null, ...shared } = props;
  const { height } = useWindowDimensions();
  const { scroller, scrollOnAdd } = useScrollOnAdd(entries.length);
  const focus = useStoryFocus(scroller, { entries, focus: focusMessageId, sayingId, onFocused });
  const { run: focusRun, onPlaced } = focus;
  // the focus runs after the jump to the end, so a story opened at a message stays there
  const onContentSizeChange = useCallback(() => {
    scrollOnAdd();
    focusRun();
  }, [scrollOnAdd, focusRun]);
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
          <View key={entry.key} onLayout={(event) => onPlaced(entry.key, event.nativeEvent.layout)}>
            <StoryEntryRow entry={entry} {...shared} />
          </View>
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
