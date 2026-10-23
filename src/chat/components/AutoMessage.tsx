// One of Auto's messages, drawn as the web draws it (D72, Gerard 23 Oct): Auto's sail avatar, then
// Auto's box, a Studio card with a 1 pt border the full width of the column, holding the answer as
// formatted text (OT-C8: markdown through marked and the app's own renderer, Markdown.tsx), the
// tool lines, a rule and 'What Auto did', and any notice (a limit, a file Auto could not open, a
// saved failure, or the live turn's stop or failure, folded in by thread-look.ts foldNotices). The
// tickets it filed or checked and the cards the reply raised sit below the box in the same column,
// never a card inside a card. Where Report this is offered (report.ts), a
// long-press anywhere on the message opens it, and the avatar and each block of the answer carry it
// as an accessible action: the message is not one element, so a screen reader still reaches the
// cards' buttons one by one. The accessible action is the same object for as long as Report this is
// offered (it calls the newest onReport), so the memoised answer is not drawn again on every frame
// of another reply.

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Divider } from '../../ui';
import type { SettleCard } from '../cards/model';
import { TicketCards } from '../cards/TaskCard';
import { ThreadCards } from '../cards/ThreadCards';
import { Markdown } from '../markdown/Markdown';
import { reportAccessibility, type ReportAccessibility } from '../report/report';
import type { AutoRow } from '../view-model';
import { AutoColumn } from './AutoColumn';
import { ReceiptsCard } from './ReceiptsCard';
import { bubbleHolds, bubbleStyle } from './thread-look';
import { ToolLines } from './ToolLines';
import { TurnNotice } from './TurnNotice';

type ReportPressProps = {
  readonly onReport: (() => void) | undefined;
  readonly children: ReactNode;
};

/** The long-press; not accessible itself, so the message's parts stay their own elements. */
function ReportPress({ onReport, children }: ReportPressProps) {
  if (!onReport) return <View>{children}</View>;
  return (
    <Pressable accessible={false} onLongPress={onReport}>
      {children}
    </Pressable>
  );
}

export type AutoMessageProps = {
  readonly row: AutoRow;
  readonly onLink: (target: WebLinkTarget) => void;
  /** Asks the last message again, for a notice that offers it. */
  readonly onRetry?: () => void;
  /** Records what the user did with one of the reply's cards. */
  readonly onCard: SettleCard;
  /** Opens Report this on the message; none where it is not offered (report.ts reportTarget). */
  readonly onReport?: () => void;
};

/** Report this as accessible actions, one object while it is offered, calling the newest onReport. */
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

type AutoWordsProps = Pick<AutoMessageProps, 'row' | 'onLink' | 'onRetry'> & {
  readonly report: ReportAccessibility;
};

/** Auto's box: the answer, the tool lines, a rule and 'What Auto did', then any notice. */
function AutoWords({ row, onLink, onRetry, report }: AutoWordsProps) {
  const tokens = useTokens();
  return (
    <View style={bubbleStyle(tokens, 'auto')}>
      {row.answer ? <Markdown text={row.answer} onLink={onLink} report={report} /> : null}
      <ToolLines lines={row.toolLines} />
      {row.answer && row.receipts ? <Divider /> : null}
      {row.receipts ? <ReceiptsCard receipts={row.receipts} onLink={onLink} /> : null}
      {row.notices.map((notice) => (
        <TurnNotice key={notice.key} notice={notice} onRetry={onRetry} />
      ))}
    </View>
  );
}

export function AutoMessage({ row, onLink, onRetry, onCard, onReport }: AutoMessageProps) {
  const report = useReportActions(onReport);
  return (
    <ReportPress onReport={onReport}>
      <AutoColumn avatar="header" report={report}>
        {bubbleHolds(row) ? (
          <AutoWords row={row} onLink={onLink} onRetry={onRetry} report={report} />
        ) : null}
        <TicketCards tickets={row.tickets} onLink={onLink} />
        <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />
      </AutoColumn>
    </ReportPress>
  );
}
