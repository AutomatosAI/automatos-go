// The thread (the handoff's chat column, drawn like the web's, D72): a FlatList of the view-model's
// rows, oldest first. The thread opens with the AI label (D73), one muted caption line that scrolls
// away with it (a new chat's empty thread shows it too). Each row is placed by thread-look.ts: the
// user's box on the right, Auto's side under its sail avatar, 24 pt between turns and 8 pt within
// Auto's run. 'Auto is thinking' takes Auto's slot until the answer replaces it there, and a turn's
// notice lands inside the box of the reply it ends (foldNotices). Only the live rows move in (the
// message just sent rises, the thinking pill fades); history never replays, and Reduce Motion
// stills both.
// The list scrolls to the end only when a row is added (a message, the thinking pill, a notice),
// never while a reply grows (README 'Interactions'); the scroll waits for the new content's size,
// and it is not animated under Reduce Motion. What sits above the thread on home (the needs strip)
// stays outside the list, as the handoff draws it. Cards whose reply was never saved are drawn
// after the saved messages (their own row). Report this goes only to the Auto messages report.ts
// names.

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import type { WebLinkTarget } from '../../navigation/web-links';
import { AiLabel } from '../../styles/ai-label';
import { useTokens } from '../../styles/theme';
import type { SettleCard } from '../cards/model';
import { ThreadCards } from '../cards/ThreadCards';
import { reportTarget, type ThreadReport } from '../report/report';
import { shouldScrollToEnd, type ChatRow } from '../view-model';
import { AutoColumn } from './AutoColumn';
import { AutoMessage } from './AutoMessage';
import {
  THREAD,
  entranceFor,
  foldNotices,
  noticeStyle,
  ownBox,
  threadPlaces,
  type RowPlace,
} from './thread-look';
import { TurnNotice } from './TurnNotice';
import { UserBubble } from './UserBubble';
import { WorkingIndicator } from './WorkingIndicator';

/** reanimated's FadeInDown starts 25 pt low; the bubble rises only 8. */
const ENTRANCES = Object.freeze({
  rise: FadeInDown.duration(THREAD.motion.riseMs).withInitialValues({
    transform: [{ translateY: THREAD.motion.risePt }],
  }),
  fade: FadeIn.duration(THREAD.motion.fadeMs),
});

export type MessageListProps = {
  readonly rows: readonly ChatRow[];
  readonly onLink: (target: WebLinkTarget) => void;
  /** Asks the last message again (a notice that offers Try again). */
  readonly onRetry?: () => void;
  /** Records what the user did with one of Auto's cards (useThread's settleCard). */
  readonly onCard: SettleCard;
  /** Report this on Auto's messages (useMessageReport). */
  readonly report: ThreadReport;
};

type RowProps = Pick<MessageListProps, 'onLink' | 'onRetry' | 'onCard' | 'report'> & {
  readonly row: ChatRow;
  readonly place: RowPlace;
};

function ThreadRow({ row, place, onLink, onRetry, onCard, report }: RowProps) {
  const tokens = useTokens();
  switch (row.type) {
    case 'user':
      return <UserBubble row={row} />;
    case 'auto': {
      const target = reportTarget(row, report.allowed);
      const onReport = target ? () => report.open(target) : undefined;
      return (
        <AutoMessage
          row={row}
          onLink={onLink}
          onRetry={onRetry}
          onCard={onCard}
          onReport={onReport}
        />
      );
    }
    case 'working':
      return (
        <AutoColumn avatar={place.avatar}>
          <WorkingIndicator boxed={ownBox(place)} />
        </AutoColumn>
      );
    case 'notice':
      return (
        <AutoColumn avatar={place.avatar}>
          <View style={noticeStyle(tokens, ownBox(place))}>
            <TurnNotice notice={row.notice} onRetry={onRetry} />
          </View>
        </AutoColumn>
      );
    case 'cards':
      return (
        <AutoColumn avatar={place.avatar}>
          <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />
        </AutoColumn>
      );
  }
}

type RowFrameProps = {
  readonly row: ChatRow;
  readonly place: RowPlace;
  readonly children: ReactNode;
};

/**
 * The gap above a row, and the live rows' entrance. Only those two keys are animated views: the
 * rest stay plain, so a streamed delta does not run reanimated's per-update work on every cell.
 * The entrance follows the key alone, so a mounted cell never swaps one for the other.
 */
function RowFrame({ row, place, children }: RowFrameProps) {
  const { spacing } = useTokens();
  const entrance = entranceFor(row.key);
  const style = { paddingTop: place.gapAbove ? spacing[place.gapAbove] : 0 };
  if (entrance === null) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={ENTRANCES[entrance]} style={style}>
      {children}
    </Animated.View>
  );
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

/** The thread's first row: the AI label, centred, 16 pt above the first message. */
function ThreadCaption() {
  const { spacing } = useTokens();
  return (
    <View style={[styles.caption, { paddingBottom: spacing.space7 }]}>
      <AiLabel />
    </View>
  );
}

export function MessageList({ rows, onLink, onRetry, onCard, report }: MessageListProps) {
  const { spacing } = useTokens();
  const list = useRef<FlatList<ChatRow>>(null);
  // counted before the fold: a notice landing in the reply's box still scrolls to it
  const onContentSizeChange = useScrollOnAdd(list, rows.length);
  const shown = useMemo(() => foldNotices(rows), [rows]);
  const places = useMemo(() => threadPlaces(shown), [shown]);
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item, index }) => (
      <RowFrame row={item} place={places[index]}>
        <ThreadRow
          row={item}
          place={places[index]}
          onLink={onLink}
          onRetry={onRetry}
          onCard={onCard}
          report={report}
        />
      </RowFrame>
    ),
    [places, onLink, onRetry, onCard, report],
  );
  return (
    <FlatList
      ref={list}
      data={shown}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={ThreadCaption}
      onContentSizeChange={onContentSizeChange}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ padding: spacing.space7 }}
    />
  );
}

const styles = StyleSheet.create({
  caption: { alignItems: 'center' },
});
