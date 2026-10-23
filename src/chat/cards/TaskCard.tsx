// A ticket the reply filed or checked (PRD-238 S6, the web's components/chatbot/task-card.tsx, drawn
// as the handoff's '#0431: filed to Inbox' with its link button): the mono headline, the serif
// title, who has it and what it last did, and 'Open on the board →' to the ticket sheet through the
// foundation's cc.ticket. A ticket whose id is not a board row id shows no link.

import { StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Button, Card, Text } from '../../ui';
import { TICKET_COPY } from '../strings';
import type { TicketRow } from './view';

const TITLE_LEVEL = 5;
const FACTS_LEVEL = 6;
const LINK_ARROW = '→';

export type TaskCardProps = {
  readonly ticket: TicketRow;
  readonly onLink: (target: WebLinkTarget) => void;
};

export function TaskCard({ ticket, onLink }: TaskCardProps) {
  const { spacing } = useTokens();
  const { link } = ticket;
  return (
    <Card padding="space5" style={{ gap: spacing.space2 }}>
      <View
        accessible
        accessibilityLabel={ticket.accessibilityLabel}
        style={{ gap: spacing.space1 }}
      >
        <Text variant="mono" tone="muted">
          {ticket.headline}
        </Text>
        <Text variant="title" level={TITLE_LEVEL} selectable>
          {ticket.title}
        </Text>
        {ticket.facts ? (
          <Text level={FACTS_LEVEL} tone="muted">
            {ticket.facts}
          </Text>
        ) : null}
      </View>
      {link ? (
        <View style={styles.link}>
          <Button
            label={`${TICKET_COPY.openOnBoard} ${LINK_ARROW}`}
            accessibilityLabel={TICKET_COPY.openOnBoard}
            onPress={() => onLink(link)}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}
    </Card>
  );
}

export type TicketCardsProps = {
  readonly tickets: readonly TicketRow[];
  readonly onLink: (target: WebLinkTarget) => void;
};

/** The reply's tickets, one card each. */
export function TicketCards({ tickets, onLink }: TicketCardsProps) {
  const { spacing } = useTokens();
  if (tickets.length === 0) return null;
  return (
    <View style={{ gap: spacing.space3 }}>
      {tickets.map((ticket) => (
        <TaskCard key={ticket.key} ticket={ticket} onLink={onLink} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start' },
});
