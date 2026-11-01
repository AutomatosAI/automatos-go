// P2 Chat's thread (PRD-001 §4.6.2 D-CAN-6, D-AI-LABEL, US-023h; CANDY-LAYOUT §4 P2 and the 390
// mock), over candy/home/chat.ts: A2's one thread, oldest first, from 16 under the stage, 16 in from
// each side, 12 between entries. Its first row is A2's untouched AI label (one muted caption,
// scrolling away with the thread). Each entry is ChatEntry's; while A2's isWorking has no words
// yet, the writing chip ('Auto is writing', its dots bouncing on Candy's one clock, still under the
// pause the stage draws). The list scrolls to the end only when an entry is added (A2's
// shouldScrollToEnd), not animated under Reduce Motion, and the keyboard closes as it is dragged.
// Given a focus message (PRD-268 US-G03), it scrolls there once instead (use-focus-scroll.ts, as
// Play's thread does).

import { useCallback, useLayoutEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useFocusScroll } from '../../../chat/components/use-focus-scroll';
import { shouldScrollToEnd } from '../../../chat/view-model';
import { AiLabel } from '../../ai-label';
import { WritingChip } from '../parts/WritingChip';
import { CANDY_CHAT_COPY } from '../strings';
import type { ChatEntry } from './chat';
import { ChatEntryRow, type ChatEntryProps } from './ChatEntry';

/** The P2 mock's thread: under the stage, its sides, and between entries. */
const THREAD = Object.freeze({ top: 16, side: 16, gap: 12 });

export type ChatViewProps = Omit<ChatEntryProps, 'entry'> & {
  readonly entries: readonly ChatEntry[];
  /** The message the thread opens at, scrolled to once (use-thread-focus.ts); null for none. */
  readonly focusMessageId?: string | null;
  /** The list scrolled to the focus message. */
  readonly onFocused?: (messageId: string) => void;
};

/** Marks a scroll when an entry is added; the next content size change carries it out. */
function useScrollOnAdd(list: { readonly current: FlatList<ChatEntry> | null }, count: number) {
  const animated = !useReducedMotion();
  const previous = useRef(count);
  const pending = useRef(false);
  useLayoutEffect(() => {
    if (shouldScrollToEnd(previous.current, count)) pending.current = true;
    previous.current = count;
  }, [count]);
  return useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    list.current?.scrollToEnd({ animated });
  }, [list, animated]);
}

/** The thread's first row: the AI label (D73). */
function ChatCaption() {
  return (
    <View style={styles.caption}>
      <AiLabel />
    </View>
  );
}

const keyOf = (entry: ChatEntry) => entry.key;

export function ChatView(props: ChatViewProps) {
  const { entries, onRetry, onCard, onLink, report, focusMessageId = null, onFocused } = props;
  const list = useRef<FlatList<ChatEntry>>(null);
  const scrollOnAdd = useScrollOnAdd(list, entries.length);
  const focus = useFocusScroll(list, entries, focusMessageId, onFocused);
  const { run: focusRun } = focus;
  // the focus runs after the jump to the end, so a thread opened at a message stays there
  const onContentSizeChange = useCallback(() => {
    scrollOnAdd();
    focusRun();
  }, [scrollOnAdd, focusRun]);
  const renderItem = useCallback<ListRenderItem<ChatEntry>>(
    ({ item }) => (
      <View style={styles.item}>
        {item.kind === 'writing' ? (
          <WritingChip />
        ) : (
          <ChatEntryRow
            entry={item}
            onRetry={onRetry}
            onCard={onCard}
            onLink={onLink}
            report={report}
          />
        )}
      </View>
    ),
    [onRetry, onCard, onLink, report],
  );
  return (
    <FlatList
      ref={list}
      data={entries}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={ChatCaption}
      onContentSizeChange={onContentSizeChange}
      onScrollToIndexFailed={focus.onScrollToIndexFailed}
      accessibilityLabel={CANDY_CHAT_COPY.threadLabel}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingTop: THREAD.top, paddingHorizontal: THREAD.side, paddingBottom: THREAD.gap },
  caption: { alignItems: 'center' },
  item: { paddingTop: THREAD.gap },
});
