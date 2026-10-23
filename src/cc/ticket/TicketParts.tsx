// The ticket sheet's blocks (handoff §2 'ticket sheet'): the head (kind row, serif title, the agent
// and when it was updated), a labelled run of text, why it waits, the 'Waiting for your answer'
// box that opens Questions, and the ticket's Deliverables, each a row that opens it. Sizes and
// token keys are chrome.ts's; the words view-model and sheet.ts's.

import { Pressable, StyleSheet, View } from 'react-native';
import PackageIcon from 'lucide-react-native/icons/package';

import { useTokens } from '../../styles/theme';
import { Card, Chip, Text } from '../../ui';
import { ICON_STROKE, joinLabel } from '../../ui/paint';
import { tonePaint } from '../../ui/variants';
import { Agent, KindRow } from '../board/TicketCard';
import { TICKET_COPY } from '../strings';
import { LINKED_ROW, QUESTION_BOX, TICKET_HEAD, TICKET_REASON, TICKET_TEXT } from './chrome';
import type { LinkedDeliverableView } from './linked';
import type { TicketReason, TicketSheetView } from './sheet';

export function TicketHead({ view }: { readonly view: TicketSheetView }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[TICKET_HEAD.gap] }}>
      <KindRow view={view.card} />
      <Text variant="title" level={TICKET_HEAD.titleLevel} accessibilityRole="header">
        {view.card.title}
      </Text>
      <Agent agent={view.card.agent} label={view.byline} level={TICKET_HEAD.bylineLevel} />
    </View>
  );
}

/** A labelled run of plain text (what it handed in, why it failed); the description has no label. */
export function TextBlock({ label, text }: { readonly label?: string; readonly text: string }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[TICKET_TEXT.gap] }}>
      {label ? (
        <Text variant="mono" tone={TICKET_TEXT.labelTone}>
          {label}
        </Text>
      ) : null}
      <Text level={TICKET_TEXT.level} selectable>
        {text}
      </Text>
    </View>
  );
}

export function ReasonLine({ reason }: { readonly reason: TicketReason }) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.reason, { gap: spacing[TICKET_REASON.gap] }]}>
      <Chip label={reason.chip} />
      <Text level={TICKET_REASON.level} tone={TICKET_REASON.tone}>
        {reason.says}
      </Text>
    </View>
  );
}

export function QuestionBox({ onPress }: { readonly onPress: () => void }) {
  const { colours, radii, spacing } = useTokens();
  const ground = tonePaint(colours, QUESTION_BOX.ground).backgroundColor;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={joinLabel(TICKET_COPY.question.title, TICKET_COPY.question.link)}
      accessibilityHint={TICKET_COPY.question.hint}
      style={{
        gap: spacing[QUESTION_BOX.gap],
        paddingHorizontal: spacing[QUESTION_BOX.paddingX],
        paddingVertical: spacing[QUESTION_BOX.paddingY],
        borderRadius: radii[QUESTION_BOX.radius],
        borderWidth: QUESTION_BOX.borderWidth,
        borderColor: colours[QUESTION_BOX.border],
        backgroundColor: ground,
      }}
    >
      <Text variant="mono" tone={QUESTION_BOX.labelTone}>
        {TICKET_COPY.question.title}
      </Text>
      <Text
        level={QUESTION_BOX.level}
        weight={QUESTION_BOX.linkWeight}
        style={styles.link}
      >{`${TICKET_COPY.question.link} →`}</Text>
    </Pressable>
  );
}

function LinkedRow({
  row,
  onOpen,
}: {
  readonly row: LinkedDeliverableView;
  readonly onOpen: () => void;
}) {
  const { colours, spacing } = useTokens();
  return (
    <Card
      onPress={onOpen}
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={TICKET_COPY.openHint}
      style={{ paddingVertical: LINKED_ROW.paddingY, paddingHorizontal: LINKED_ROW.paddingX }}
    >
      <View style={[styles.row, { gap: spacing[LINKED_ROW.gap] }]}>
        <PackageIcon
          size={LINKED_ROW.iconSize}
          color={colours[LINKED_ROW.iconColour]}
          strokeWidth={ICON_STROKE}
        />
        <View style={styles.grow}>
          <Text variant="title" level={LINKED_ROW.titleLevel}>
            {row.title}
          </Text>
          {row.kind ? (
            <Text level={LINKED_ROW.metaLevel} tone={LINKED_ROW.metaTone}>
              {row.kind}
            </Text>
          ) : null}
        </View>
        <Text level={LINKED_ROW.metaLevel} tone={LINKED_ROW.metaTone}>
          {`${TICKET_COPY.open} →`}
        </Text>
      </View>
    </Card>
  );
}

export type LinkedDeliverablesProps = {
  readonly rows: readonly LinkedDeliverableView[];
  readonly onOpen: (href: string) => void;
};

export function LinkedDeliverables({ rows, onOpen }: LinkedDeliverablesProps) {
  const { spacing } = useTokens();
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: spacing[LINKED_ROW.listGap] }}>
      <Text variant="mono" tone={TICKET_TEXT.labelTone}>
        {TICKET_COPY.deliverables}
      </Text>
      {rows.map((row) => (
        <LinkedRow key={row.id} row={row} onOpen={() => onOpen(row.href)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  reason: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  link: { textDecorationLine: 'underline' },
});
