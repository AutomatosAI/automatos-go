// The thread (the handoff's chat column): a FlatList of the view-model's rows, oldest first. It
// scrolls to the end only when a row is added (a message, 'Auto is working…', a notice), never
// while a reply grows (README 'Interactions'); the scroll waits for the new content's size, and it
// is not animated under Reduce Motion. What sits above the thread on home (the needs strip) stays
// outside the list, as the handoff draws it. Cards whose reply was never saved are drawn after the
// saved messages (their own row).

import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import type { SettleCard } from '../cards/model';
import { ThreadCards } from '../cards/ThreadCards';
import { shouldScrollToEnd, type ChatRow } from '../view-model';
import { AutoMessage } from './AutoMessage';
import { TurnNotice } from './TurnNotice';
import { UserBubble } from './UserBubble';
import { WorkingIndicator } from './WorkingIndicator';

export type MessageListProps = {
  readonly rows: readonly ChatRow[];
  readonly onLink: (target: WebLinkTarget) => void;
  /** Asks the last message again (a notice that offers Try again). */
  readonly onRetry?: () => void;
  /** Records what the user did with one of Auto's cards (useThread's settleCard). */
  readonly onCard: SettleCard;
};

type RowProps = Pick<MessageListProps, 'onLink' | 'onRetry' | 'onCard'> & {
  readonly row: ChatRow;
};

function ThreadRow({ row, onLink, onRetry, onCard }: RowProps) {
  switch (row.type) {
    case 'user':
      return <UserBubble row={row} />;
    case 'auto':
      return <AutoMessage row={row} onLink={onLink} onRetry={onRetry} onCard={onCard} />;
    case 'working':
      return <WorkingIndicator />;
    case 'notice':
      return <TurnNotice notice={row.notice} onRetry={onRetry} />;
    case 'cards':
      return <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />;
  }
}

/** Marks a scroll when a row is added; the next content size change carries it out. */
function useScrollOnAdd(list: RefObject<FlatList<ChatRow> | null>, count: number) {
  const animated = !useReducedMotion();
  const previous = useRef(count);
  const pending = useRef(false);
  // a layout effect: it runs before the new content reports its size
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

const keyOf = (row: ChatRow) => row.key;

export function MessageList({ rows, onLink, onRetry, onCard }: MessageListProps) {
  const { spacing } = useTokens();
  const list = useRef<FlatList<ChatRow>>(null);
  const onContentSizeChange = useScrollOnAdd(list, rows.length);
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => <ThreadRow row={item} onLink={onLink} onRetry={onRetry} onCard={onCard} />,
    [onLink, onRetry, onCard],
  );
  return (
    <FlatList
      ref={list}
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderItem}
      onContentSizeChange={onContentSizeChange}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ padding: spacing.space7, gap: spacing.space7 }}
    />
  );
}
