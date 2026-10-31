// Play's thread (Ember 01-02, US-016k): A2's rows (src/chat/view-model.ts) drawn with US-017c's
// pieces, oldest first, opening with the AI label (PlayThreadCaption, D73). The user's words in
// Play's outlined bubble; Auto's reply unboxed: its tool chips, its words (A2's markdown on the
// style's tokens) with the caret while this phone reads them, the report card for each Deliverable
// the turn made (dropping in as it lands, US-017g), "What Auto did", then A2's own notices, ticket
// cards and cards (Mission suggestion, plan and tool approval, withdraw offer), dressed by the
// primitives. 'Auto is thinking' is not a row here: Auto's row under the thread says it (its text
// twin). Report this long-presses Auto's message and is each block's accessible action, as on A2's
// thread (AutoMessage.tsx is the reference). The list scrolls to the end only when a row is added
// (A2's shouldScrollToEnd). A message carrying the day's brief (row.brief, PRD-268 US-G06) draws
// Play's brief card in place of its words: the card holds the same words (Auto's Read). Given a
// focus message (US-G03), the list scrolls there once (use-focus-scroll.ts), as A2's thread does.
// A suggestion Auto posted draws its card while it is open, else its message (ThreadSuggestion).

import { useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PlayBriefCard } from '../../brief/BriefCard';
import { ThreadCards } from '../../chat/cards/ThreadCards';
import type { SettleCard } from '../../chat/cards/model';
import { TicketCards } from '../../chat/cards/TaskCard';
import { TurnNotice } from '../../chat/components/TurnNotice';
import { useFocusScroll } from '../../chat/components/use-focus-scroll';
import { Markdown } from '../../chat/markdown/Markdown';
import {
  reportAccessibility,
  reportTarget,
  type ReportAccessibility,
  type ThreadReport,
} from '../../chat/report/report';
import { shouldScrollToEnd, type AutoRow, type ChatRow } from '../../chat/view-model';
import type { DeliverableRef } from '../../core/web/lib/chat/deliverables';
import type { WebLinkTarget } from '../../navigation/web-links';
import { routes } from '../../navigation/routes';
import { ThreadSuggestion } from '../../suggestions/ThreadSuggestion';
import {
  AutoMessage,
  PlayThreadCaption,
  ReceiptsLine,
  ReportCard,
  ToolChip,
  UserMessage,
} from '../play/companion';
import { useTokens } from '../theme';
import { playReceiptRows, reportEyebrowOf, risesIn, toolChipsOf, userWords } from './play-thread';
import { LOOSE_REPORTS } from './shelf';

export type PlayThreadProps = {
  readonly rows: readonly ChatRow[];
  /** The live reply's key while this phone reads it: its words carry the caret. */
  readonly caretKey: string | null;
  /** The report cards by row (shelf.ts placeReports). */
  readonly reports: ReadonlyMap<string, readonly DeliverableRef[]>;
  readonly onLink: (target: WebLinkTarget) => void;
  readonly onRetry: () => void;
  readonly onCard: SettleCard;
  readonly report: ThreadReport;
  /** The message the thread opens at, scrolled to once (PRD-268 US-G03, use-thread-focus.ts). */
  readonly focusMessageId?: string | null;
  /** The list scrolled to the focus message. */
  readonly onFocused?: (messageId: string) => void;
};

type Shared = Omit<
  PlayThreadProps,
  'rows' | 'reports' | 'caretKey' | 'focusMessageId' | 'onFocused'
>;

const NO_REPORTS: readonly DeliverableRef[] = Object.freeze([]);

/** Report this as accessible actions, one object while offered, calling the newest onReport. */
function useReportActions(onReport: (() => void) | undefined): ReportAccessibility {
  const latest = useRef(onReport);
  useLayoutEffect(() => {
    latest.current = onReport;
  });
  const offered = onReport !== undefined;
  return useMemo(
    () => reportAccessibility(offered ? () => latest.current?.() : undefined),
    [offered],
  );
}

type ReportsProps = {
  readonly refs: readonly DeliverableRef[];
  /** The reply being written holds them: they just landed, so they drop in. */
  readonly drop?: boolean;
};

function Reports({ refs, drop = false }: ReportsProps) {
  const router = useRouter();
  return refs.map((ref) => (
    <ReportCard
      key={ref.id}
      title={ref.title}
      eyebrow={reportEyebrowOf(ref)}
      onOpen={() => router.push(routes.cc.deliverable(ref.id))}
      drop={drop}
    />
  ));
}

type PlayAutoProps = Shared & {
  readonly row: AutoRow;
  readonly caret: boolean;
  readonly refs: readonly DeliverableRef[];
};

function PlayAuto({ row, caret, refs, onLink, onRetry, onCard, report }: PlayAutoProps) {
  const { spacing } = useTokens();
  const target = reportTarget(row, report.allowed);
  const onReport = target ? () => report.open(target) : undefined;
  const actions = useReportActions(onReport);
  const links = new Map(row.receipts?.lines.map((line) => [line.key, line.link] as const));
  const openReceipt = (key: string) => {
    const link = links.get(key);
    if (link) onLink(link);
  };
  const words = row.answer ? <Markdown text={row.answer} onLink={onLink} report={actions} /> : null;
  const body = (
    <View style={{ gap: spacing.space5 }}>
      {toolChipsOf(row.toolLines).map((chip) => (
        <ToolChip key={chip.key} chip={chip} />
      ))}
      {row.brief ? (
        <PlayBriefCard brief={row.brief} onLink={onLink} />
      ) : words || caret ? (
        <AutoMessage text="" streaming={caret} rise={risesIn(row.key)}>
          {words}
        </AutoMessage>
      ) : null}
      <Reports refs={refs} drop={risesIn(row.key)} />
      <ReceiptsLine rows={playReceiptRows(row.receipts)} onRow={openReceipt} />
      {row.notices.map((notice) => (
        <TurnNotice key={notice.key} notice={notice} onRetry={onRetry} />
      ))}
      <TicketCards tickets={row.tickets} onLink={onLink} />
      <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />
    </View>
  );
  if (!onReport) return body;
  return (
    <Pressable accessible={false} onLongPress={onReport}>
      {body}
    </Pressable>
  );
}

type RowProps = Shared & {
  readonly row: ChatRow;
  readonly caretKey: string | null;
  readonly refs: readonly DeliverableRef[];
};

function PlayRow({ row, caretKey, refs, ...shared }: RowProps): ReactNode {
  switch (row.type) {
    case 'user':
      return <UserMessage text={userWords(row)} rise={risesIn(row.key)} />;
    case 'auto':
      return <PlayAuto row={row} caret={row.key === caretKey} refs={refs} {...shared} />;
    case 'working':
      return null; // Auto's row says it (isDrawn leaves the row out)
    case 'notice':
      return <TurnNotice notice={row.notice} onRetry={shared.onRetry} />;
    case 'cards':
      return <ThreadCards cards={row.cards} onSettled={shared.onCard} onLink={shared.onLink} />;
    case 'suggestion':
      return (
        <ThreadSuggestion
          suggestionId={row.suggestionId}
          fallback={<PlayAuto row={row.text} caret={false} refs={refs} {...shared} />}
        />
      );
  }
}

/** Marks a scroll when a row is added; the next content size change carries it out. */
function useScrollOnAdd(list: { readonly current: FlatList<ChatRow> | null }, count: number) {
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

const keyOf = (row: ChatRow) => row.key;
/** Auto's row under the thread says he is thinking: A2's thinking pill is not drawn here. */
const isDrawn = (row: ChatRow) => row.type !== 'working';

export function PlayThread(props: PlayThreadProps) {
  const { rows, caretKey, reports, focusMessageId = null, onFocused, ...shared } = props;
  const { spacing } = useTokens();
  const list = useRef<FlatList<ChatRow>>(null);
  const drawn = useMemo(() => rows.filter(isDrawn), [rows]);
  const scrollOnAdd = useScrollOnAdd(list, drawn.length);
  const focus = useFocusScroll(list, drawn, focusMessageId, onFocused);
  const { run: focusRun } = focus;
  // the focus runs after the jump to the end, so a thread opened at a message stays there
  const onContentSizeChange = useCallback(() => {
    scrollOnAdd();
    focusRun();
  }, [scrollOnAdd, focusRun]);
  const loose = reports.get(LOOSE_REPORTS) ?? NO_REPORTS;
  const { onLink, onRetry, onCard, report } = shared;
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => (
      <View style={{ paddingTop: spacing.space7 }}>
        <PlayRow
          row={item}
          caretKey={caretKey}
          refs={reports.get(item.key) ?? NO_REPORTS}
          onLink={onLink}
          onRetry={onRetry}
          onCard={onCard}
          report={report}
        />
      </View>
    ),
    [spacing, caretKey, reports, onLink, onRetry, onCard, report],
  );
  return (
    <FlatList
      ref={list}
      data={drawn}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={PlayThreadCaption}
      ListFooterComponent={loose.length > 0 ? <Reports refs={loose} /> : null}
      onContentSizeChange={onContentSizeChange}
      onScrollToIndexFailed={focus.onScrollToIndexFailed}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ padding: spacing.space7 }}
    />
  );
}
