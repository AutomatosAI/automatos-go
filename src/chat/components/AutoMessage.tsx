// One of Auto's messages (the handoff's thread): the 20 pt ink 'A' mark and the mono 'AUTO' label,
// then the answer as formatted text with no bubble and no box (OT-C8: markdown through marked and
// the app's own renderer, markdown/Markdown.tsx), the tool lines, 'What Auto did', any notice (a
// limit, a file Auto could not open, a saved failure), the tickets it filed or checked and the cards
// the reply raised. Where Report this is offered (report.ts), a long-press anywhere on the message
// opens it, and the header and each block of the answer carry it as an accessible action: the
// message is not one element, so a screen reader still reaches the cards' buttons one by one. The
// accessible action is the same object for as long as Report this is offered (it calls the newest
// onReport), so the memoised answer is not drawn again on every frame of another reply.

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import type { SettleCard } from '../cards/model';
import { TicketCards } from '../cards/TaskCard';
import { ThreadCards } from '../cards/ThreadCards';
import { Markdown } from '../markdown/Markdown';
import { reportAccessibility, type ReportAccessibility } from '../report/report';
import { CHAT_COPY } from '../strings';
import type { AutoRow } from '../view-model';
import { ReceiptsCard } from './ReceiptsCard';
import { ToolLines } from './ToolLines';
import { TurnNotice } from './TurnNotice';

const MARK_SIZE = 20;
const MARK_LEVEL = 6;

function AutoHeader({ report }: { readonly report: ReportAccessibility }) {
  const { colours, radii, spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={CHAT_COPY.autoSaid}
      {...report}
      style={[styles.header, { gap: spacing.space2 }]}
    >
      <View
        style={[styles.mark, { backgroundColor: colours.primary, borderRadius: radii.segment }]}
      >
        <Text variant="title" level={MARK_LEVEL} tone="inverse">
          {CHAT_COPY.autoMark}
        </Text>
      </View>
      <Text variant="mono" tone="muted">
        {CHAT_COPY.autoLabel}
      </Text>
    </View>
  );
}

type ReportPressProps = {
  readonly onReport: (() => void) | undefined;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
};

/** The long-press; not accessible itself, so the message's parts stay their own elements. */
function ReportPress({ onReport, style, children }: ReportPressProps) {
  if (!onReport) return <View style={style}>{children}</View>;
  return (
    <Pressable accessible={false} onLongPress={onReport} style={style}>
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

export function AutoMessage({ row, onLink, onRetry, onCard, onReport }: AutoMessageProps) {
  const { spacing } = useTokens();
  const report = useReportActions(onReport);
  return (
    <ReportPress onReport={onReport} style={{ gap: spacing.space3 }}>
      <AutoHeader report={report} />
      {row.answer ? <Markdown text={row.answer} onLink={onLink} report={report} /> : null}
      <ToolLines lines={row.toolLines} />
      {row.receipts ? <ReceiptsCard receipts={row.receipts} onLink={onLink} /> : null}
      {row.notices.map((notice) => (
        <TurnNotice key={notice.key} notice={notice} onRetry={onRetry} />
      ))}
      <TicketCards tickets={row.tickets} onLink={onLink} />
      <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />
    </ReportPress>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
