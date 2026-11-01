// One entry of Candy's Chat view (US-023h; CANDY-LAYOUT §4 P2 and the kit's chat/entries.tsx at
// 3920359d5), over candy/home/chat.ts: the user's bubble; Auto's reply as its tool chips, his
// bubble holding A2's own markdown renderer (the thread's words, as every style's thread draws
// them), a row for each Deliverable the turn made, then A2's notices (with Try again), ticket
// cards and cards (approvals, a Mission suggestion, a withdraw offer) placed and drawn as A2 draws
// them, never restyled. Report this long-presses Auto's reply and is each block's accessible action
// where A2 offers it (AutoMessage.tsx is the reference). 'Auto is writing' is the view's own row
// (ChatView.tsx). Entries are memoised by value: a streamed delta redraws only the entry that
// changed. A reply carrying the day's brief (row.brief, PRD-268 US-G06; only where discovery lists
// `brief`) draws the brief's own view (BriefBody) in Auto's bubble in place of its words, with the
// brief card's one entrance, as Studio's StudioBriefCard draws it in Auto's box; Report this stays
// on the message. A suggestion Auto posted (PRD-268 §6.5.1) draws its card while it is open, else
// its message as Auto's reply (ThreadSuggestion, as Play's thread draws it).

import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BriefBody, BriefEntrance } from '../../../brief/BriefCard';
import { ThreadCards } from '../../../chat/cards/ThreadCards';
import type { SettleCard } from '../../../chat/cards/model';
import { TicketCards } from '../../../chat/cards/TaskCard';
import type { FollowLink } from '../../../chat/components/follow-link';
import { sameValue } from '../../../chat/components/row-same';
import { TurnNotice } from '../../../chat/components/TurnNotice';
import { Markdown } from '../../../chat/markdown/Markdown';
import { reportTarget, type ThreadReport } from '../../../chat/report/report';
import { ThreadSuggestion } from '../../../suggestions/ThreadSuggestion';
import { useReportActions } from '../../arcade/parts/use-report-actions';
import type { ChatEntry, DeliverableRow } from './chat';
import { AutoBubble, DeliverableRowView, ToolChipView, UserBubble } from './ChatBubbles';

/** Between the pieces of one reply: the thread's own 12. */
const GAP = 12;

export type ChatEntryProps = {
  readonly entry: Exclude<ChatEntry, { kind: 'writing' }>;
  readonly onRetry: () => void;
  readonly onCard: SettleCard;
  readonly onLink: FollowLink;
  readonly report: ThreadReport;
};

type AutoProps = Omit<ChatEntryProps, 'entry'> & {
  readonly entry: Extract<ChatEntry, { kind: 'auto' }>;
};

function Deliverables({ rows }: { readonly rows: readonly DeliverableRow[] }) {
  return rows.map((row) => <DeliverableRowView key={row.key} row={row} />);
}

function AutoEntry({ entry, onRetry, onCard, onLink, report }: AutoProps) {
  const { row } = entry;
  const target = row.answer ? reportTarget(row, report.allowed) : null;
  const onReport = target ? () => report.open(target) : undefined;
  const actions = useReportActions(onReport);
  const body = (
    <View style={styles.entry}>
      {entry.chips.map((chip) => (
        <ToolChipView key={chip.key} chip={chip} onLink={onLink} />
      ))}
      {row.brief ? (
        <BriefEntrance brief={row.brief}>
          <AutoBubble>
            <BriefBody brief={row.brief} onLink={onLink} />
          </AutoBubble>
        </BriefEntrance>
      ) : row.answer ? (
        <AutoBubble>
          <Markdown text={row.answer} onLink={onLink} report={actions} />
        </AutoBubble>
      ) : null}
      <Deliverables rows={entry.deliverables} />
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

function ChatEntryView(props: ChatEntryProps) {
  const { entry } = props;
  switch (entry.kind) {
    case 'you':
      return <UserBubble text={entry.text} label={entry.label} />;
    case 'auto':
      return <AutoEntry {...props} entry={entry} />;
    case 'suggestion':
      return (
        <ThreadSuggestion
          suggestionId={entry.suggestionId}
          fallback={<AutoEntry {...props} entry={entry.text} />}
        />
      );
    case 'notice':
      return <TurnNotice notice={entry.notice} onRetry={props.onRetry} />;
    case 'loose':
      return (
        <View style={styles.entry}>
          <Deliverables rows={entry.deliverables} />
          <ThreadCards cards={entry.cards} onSettled={props.onCard} onLink={props.onLink} />
        </View>
      );
  }
}

/** An entry draws again only when it changed: equal in value, the same handlers. */
export const ChatEntryRow = memo(ChatEntryView, sameValue);

const styles = StyleSheet.create({
  entry: { gap: GAP },
});
