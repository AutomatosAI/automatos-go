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
// names. Every row is built anew on each streamed delta, so each row is memoised on row-same.ts's
// sameThreadRow (equal in value, the same handlers) and Try again is one stable function that
// calls the screen's latest: only the row that changed draws again.
// The list says whether the day's brief card is on screen (PRD-268 US-G06: home's needs strip then
// shrinks to its count, src/brief/on-screen.tsx); outside home nobody listens. Given a focus message
// (US-G03: the Auto thread opened at the day's brief), it scrolls there once (use-focus-scroll.ts).

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem, type ViewToken } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { briefOnScreen } from '../../brief/model';
import { useReportBriefOnScreen } from '../../brief/on-screen';
import type { WebLinkTarget } from '../../navigation/web-links';
import { AiLabel } from '../../styles/ai-label';
import { useTokens } from '../../styles/theme';
import type { SettleCard } from '../cards/model';
import { ThreadCards } from '../cards/ThreadCards';
import { reportTarget, type ThreadReport } from '../report/report';
import { shouldScrollToEnd, type ChatRow } from '../view-model';
import { AutoColumn } from './AutoColumn';
import { AutoMessage } from './AutoMessage';
import { sameThreadRow } from './row-same';
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
import { useFocusScroll } from './use-focus-scroll';
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
  /** The message the thread opens at, scrolled to once (PRD-268 US-G03, use-thread-focus.ts). */
  readonly focusMessageId?: string | null;
  /** The list scrolled to the focus message. */
  readonly onFocused?: (messageId: string) => void;
};

type RowProps = Pick<MessageListProps, 'onLink' | 'onRetry' | 'onCard' | 'report'> & {
  readonly row: ChatRow;
  readonly place: RowPlace;
};

function ThreadRowView({ row, place, onLink, onRetry, onCard, report }: RowProps) {
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

/** A row draws again only when it changed: a streamed delta redraws the reply, not the thread. */
const ThreadRow = memo(ThreadRowView, sameThreadRow);

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

/**
 * Try again as one function for the list's life, calling the screen's latest (which changes with
 * every delta): a row's memo then holds while the reply streams. None while the screen gives none.
 */
function useStableRetry(onRetry: (() => void) | undefined): (() => void) | undefined {
  const latest = useRef(onRetry);
  useEffect(() => {
    latest.current = onRetry;
  });
  const retry = useCallback(() => latest.current?.(), []);
  return onRetry ? retry : undefined;
}

const keyOf = (row: ChatRow) => row.key;

/** A row counts as on screen once a tenth of it shows. */
const VIEWABILITY = Object.freeze({ itemVisiblePercentThreshold: 10 });

type Sighting = { readonly viewableItems: readonly ViewToken<ChatRow>[] };

/**
 * Tells home whether the brief card is on screen, from the rows the list shows; one function for
 * the list's life (FlatList refuses a new one), and off again when the list goes.
 */
function useBriefSighting(): (sighting: Sighting) => void {
  const report = useReportBriefOnScreen();
  const latest = useRef(report);
  useEffect(() => {
    latest.current = report;
  });
  useEffect(() => () => latest.current(false), []);
  return useCallback(
    ({ viewableItems }: Sighting) => latest.current(briefOnScreen(viewableItems)),
    [],
  );
}

/** The thread's first row: the AI label, centred, 16 pt above the first message. */
function ThreadCaption() {
  const { spacing } = useTokens();
  return (
    <View style={[styles.caption, { paddingBottom: spacing.space7 }]}>
      <AiLabel />
    </View>
  );
}

export function MessageList(props: MessageListProps) {
  const { rows, onLink, onRetry, onCard, report, focusMessageId = null, onFocused } = props;
  const { spacing } = useTokens();
  const list = useRef<FlatList<ChatRow>>(null);
  const retry = useStableRetry(onRetry);
  // counted before the fold: a notice landing in the reply's box still scrolls to it
  const scrollOnAdd = useScrollOnAdd(list, rows.length);
  const onViewableItemsChanged = useBriefSighting();
  const shown = useMemo(() => foldNotices(rows), [rows]);
  const focus = useFocusScroll(list, shown, focusMessageId, onFocused);
  const { run: focusRun } = focus;
  // the focus runs after the jump to the end, so a thread opened at a message stays there
  const onContentSizeChange = useCallback(() => {
    scrollOnAdd();
    focusRun();
  }, [scrollOnAdd, focusRun]);
  const places = useMemo(() => threadPlaces(shown), [shown]);
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item, index }) => (
      <RowFrame row={item} place={places[index]}>
        <ThreadRow
          row={item}
          place={places[index]}
          onLink={onLink}
          onRetry={retry}
          onCard={onCard}
          report={report}
        />
      </RowFrame>
    ),
    [places, onLink, retry, onCard, report],
  );
  return (
    <FlatList
      ref={list}
      data={shown}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={ThreadCaption}
      onContentSizeChange={onContentSizeChange}
      onScrollToIndexFailed={focus.onScrollToIndexFailed}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ padding: spacing.space7 }}
    />
  );
}

const styles = StyleSheet.create({
  caption: { alignItems: 'center' },
});
