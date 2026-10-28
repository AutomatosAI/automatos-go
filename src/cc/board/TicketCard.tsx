// A ticket on the Board (handoff §2 'Board' card): the kind row (#number, kind icon, KIND · a raised
// priority, the status as dot and WORD), the serif title, the reason chip from the vendored
// ticket-stage, the tags and the agent's swatch and name. The whole card is one button that opens
// the ticket sheet (routes.cc.ticket), whose head reuses the kind row and the agent. Its fields are
// view-model.ts's; its sizes chrome.ts's. PRD-268 (US-G05): with the server's state, the kind row
// says it (glyph and word) where the board's dot was, the next step and Try again sit under the
// title, and VoiceOver offers Try again as the card's own action (the card is one button).

import type { LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import BookMarked from 'lucide-react-native/icons/book-bookmark';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import SquareCheckBig from 'lucide-react-native/icons/square-check-big';
import Target from 'lucide-react-native/icons/target';

import type { TicketKind } from '../../core/web/components/activity/board/ticket-kind';
import { useTokens } from '../../styles/theme';
import { Card, Chip, StatusPip, Text } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import type { TextLevel } from '../../ui/variants';
import { StateMark, StatusBlock, retryAccessibility } from '../status/StatusLine';
import { useRetry } from '../status/use-retry';
import { BOARD_COPY } from '../strings';
import { TICKET_AGENT, TICKET_CARD, TICKET_TAG } from './chrome';
import type { TicketCardView } from './view-model';

/** The handoff's kind icons (board.ts KIND_ICONS): book-marked ships as book-bookmark. */
const KIND_ICON_COMPONENTS: Readonly<Record<TicketKind, LucideIcon>> = Object.freeze({
  Task: SquareCheckBig,
  Playbook: BookMarked,
  Mission: Target,
  Routine: RefreshCw,
});

export function KindRow({ view }: { readonly view: TicketCardView }) {
  const { colours, spacing } = useTokens();
  const Icon = KIND_ICON_COMPONENTS[view.kind];
  return (
    <View style={[styles.row, { gap: spacing[TICKET_CARD.kindGap] }]}>
      {view.number ? (
        <Text variant="mono" tone={TICKET_CARD.kindTone}>
          {view.number}
        </Text>
      ) : null}
      <Icon
        size={TICKET_CARD.kindIconSize}
        color={colours[TICKET_CARD.kindIconColour]}
        strokeWidth={ICON_STROKE}
      />
      <Text variant="mono" tone={TICKET_CARD.kindTone}>
        {view.kindWord}
      </Text>
      {view.priority ? (
        <Text variant="mono" tone={TICKET_CARD.priorityTone}>
          {`${BOARD_COPY.separator} ${view.priority}`}
        </Text>
      ) : null}
      <View style={styles.spacer} />
      {view.rowStatus ? (
        <StateMark state={view.rowStatus.state} />
      ) : (
        <StatusPip status={view.status.pip} word={view.status.word} />
      )}
    </View>
  );
}

function Tag({ label }: { readonly label: string }) {
  const { colours, radii, spacing } = useTokens();
  return (
    <View
      style={{
        borderRadius: radii[TICKET_TAG.radius],
        backgroundColor: colours[TICKET_TAG.ground],
        paddingHorizontal: spacing[TICKET_TAG.paddingX],
        paddingVertical: TICKET_TAG.paddingY,
      }}
    >
      <Text variant="mono" tone={TICKET_TAG.tone} style={{ textTransform: TICKET_TAG.textCase }}>
        {label}
      </Text>
    </View>
  );
}

export type AgentProps = {
  readonly agent: TicketCardView['agent'];
  /** What follows the swatch: the name on a card, 'Ledger · updated 08:06' on the sheet. */
  readonly label?: string;
  readonly level?: TextLevel;
};

export function Agent({ agent, label, level = TICKET_AGENT.level }: AgentProps) {
  const { colours, radii } = useTokens();
  return (
    <View style={[styles.agent, { gap: TICKET_AGENT.gap }]}>
      <View
        style={{
          width: TICKET_AGENT.swatchSize,
          height: TICKET_AGENT.swatchSize,
          borderRadius: radii[TICKET_AGENT.swatchRadius],
          backgroundColor: colours[agent.swatch],
        }}
      />
      <Text level={level} weight={TICKET_AGENT.weight} tone={TICKET_AGENT.tone}>
        {label ?? agent.name}
      </Text>
    </View>
  );
}

function Foot({ view }: { readonly view: TicketCardView }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.row, { gap: spacing[TICKET_CARD.footGap] }]}>
      {view.tags.map((tag) => (
        <Tag key={tag} label={tag} />
      ))}
      <View style={styles.spacer} />
      <Agent agent={view.agent} />
    </View>
  );
}

export type TicketCardProps = { readonly view: TicketCardView };

export function TicketCard({ view }: TicketCardProps) {
  const router = useRouter();
  const retry = useRetry(view.rowStatus?.retry ?? null);
  return (
    <Card
      onPress={() => router.push(view.href)}
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={BOARD_COPY.openHint}
      {...retryAccessibility(view.rowStatus, retry)}
      style={{
        paddingVertical: TICKET_CARD.paddingY,
        paddingHorizontal: TICKET_CARD.paddingX,
        gap: TICKET_CARD.rowGap,
      }}
    >
      <KindRow view={view} />
      <Text variant="title" level={TICKET_CARD.titleLevel}>
        {view.title}
      </Text>
      {view.rowStatus ? (
        <StatusBlock status={view.rowStatus} retry={retry} retryIsCardAction />
      ) : null}
      {view.reason ? <Chip label={view.reason} /> : null}
      <Foot view={view} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  spacer: { flexGrow: 1 },
  agent: { flexDirection: 'row', alignItems: 'center' },
});
