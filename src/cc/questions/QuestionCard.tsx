// One open question (handoff §2 'Questions', the web's question-card.tsx): the bot icon, who asked
// and the ticket as a link (the ticket sheet, opened at this question), the question as plain
// paragraphs, the blocked cascade, and the controls a role that may answer gets (QuestionControls).
// Words are view-model.ts's, controls controls.ts's, sizes and token keys chrome.ts's. PRD-268
// (US-G05): under the head, the server's state as glyph and word, its next step and Try again.

import { useRouter } from 'expo-router';
import Bot from 'lucide-react-native/icons/bot';
import CornerDownRight from 'lucide-react-native/icons/corner-down-right';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Card, Text } from '../../ui';
import { ICON_STROKE, hitSlopFor, joinLabel, tint } from '../../ui/paint';
import { StatusBlock } from '../status/StatusLine';
import { useRetry } from '../status/use-retry';
import { BOARD_COPY, QUESTIONS_COPY } from '../strings';
import { CASCADE_BOX, QUESTION_CARD, QUESTION_HEAD, QUESTION_TEXT } from './chrome';
import { QuestionControlsPanel } from './QuestionControls';
import { useQuestionCard } from './use-questions';
import type { CascadeView, QuestionCardView, QuestionTicketView } from './view-model';

function TicketLink({ ticket }: { readonly ticket: QuestionTicketView }) {
  const router = useRouter();
  const words = (
    <Text level={QUESTION_HEAD.level} tone={QUESTION_HEAD.tone} numberOfLines={1}>
      {ticket.label}
    </Text>
  );
  const href = ticket.href;
  if (!href) return <View style={styles.shrink}>{words}</View>;
  return (
    <Pressable
      onPress={() => router.push(href)}
      hitSlop={hitSlopFor(QUESTION_HEAD.iconSize)}
      accessibilityRole="link"
      accessibilityLabel={ticket.label}
      accessibilityHint={QUESTIONS_COPY.ticketHint}
      style={styles.shrink}
    >
      {words}
    </Pressable>
  );
}

function QuestionHead({ view }: { readonly view: QuestionCardView }) {
  const { colours, spacing } = useTokens();
  return (
    <View style={[styles.row, { gap: spacing[QUESTION_HEAD.gap] }]}>
      <Bot
        size={QUESTION_HEAD.iconSize}
        color={colours[QUESTION_HEAD.iconColour]}
        strokeWidth={ICON_STROKE}
      />
      <Text level={QUESTION_HEAD.level} weight={QUESTION_HEAD.agentWeight}>
        {view.agent}
      </Text>
      {view.ticket ? (
        <>
          <Text
            level={QUESTION_HEAD.level}
            tone={QUESTION_HEAD.tone}
            importantForAccessibility="no"
          >
            {BOARD_COPY.separator}
          </Text>
          <TicketLink ticket={view.ticket} />
        </>
      ) : null}
    </View>
  );
}

function Cascade({ cascade }: { readonly cascade: CascadeView }) {
  const { colours, radii } = useTokens();
  return (
    <View
      style={{
        gap: CASCADE_BOX.gap,
        paddingVertical: CASCADE_BOX.paddingY,
        paddingHorizontal: CASCADE_BOX.paddingX,
        borderRadius: radii[CASCADE_BOX.radius],
        borderWidth: 1,
        borderColor: tint(colours[CASCADE_BOX.border], CASCADE_BOX.borderAlpha),
        backgroundColor: tint(colours[CASCADE_BOX.ground], CASCADE_BOX.groundAlpha),
      }}
    >
      <Text level={CASCADE_BOX.level} weight={CASCADE_BOX.titleWeight} tone={CASCADE_BOX.tone}>
        {cascade.title}
      </Text>
      {cascade.rows.map((row) => (
        <View
          key={row.id}
          style={[styles.row, { gap: CASCADE_BOX.rowGap }]}
          accessible
          accessibilityLabel={joinLabel(row.title, row.status)}
        >
          <CornerDownRight
            size={CASCADE_BOX.iconSize}
            color={colours[CASCADE_BOX.iconColour]}
            strokeWidth={ICON_STROKE}
          />
          <Text level={CASCADE_BOX.level} tone={CASCADE_BOX.tone} style={styles.shrink}>
            {row.status ? `${row.title} ${BOARD_COPY.separator} ${row.status}` : row.title}
          </Text>
        </View>
      ))}
      {cascade.more ? (
        <Text level={CASCADE_BOX.level} tone={CASCADE_BOX.tone}>
          {cascade.more}
        </Text>
      ) : null}
    </View>
  );
}

export type QuestionCardProps = {
  readonly view: QuestionCardView;
  /** The role may answer and dismiss (roleCan 'answer'); otherwise the card is read-only. */
  readonly mayAnswer: boolean;
};

export function QuestionCard({ view, mayAnswer }: QuestionCardProps) {
  const { spacing } = useTokens();
  const card = useQuestionCard(view, mayAnswer);
  const retry = useRetry(view.rowStatus?.retry ?? null);
  return (
    <Card
      radius={QUESTION_CARD.radius}
      style={{
        gap: spacing[QUESTION_CARD.gap],
        paddingVertical: QUESTION_CARD.paddingY,
        paddingHorizontal: spacing[QUESTION_CARD.paddingX],
      }}
    >
      <QuestionHead view={view} />
      {view.rowStatus ? <StatusBlock status={view.rowStatus} retry={retry} withMark /> : null}
      <View style={{ gap: spacing[QUESTION_TEXT.gap] }}>
        {view.paragraphs.map((paragraph, index) => (
          <Text key={index} level={QUESTION_TEXT.level} selectable>
            {paragraph}
          </Text>
        ))}
      </View>
      {view.cascade ? <Cascade cascade={view.cascade} /> : null}
      {card.controls ? <QuestionControlsPanel controls={card.controls} card={card} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1, minWidth: 0 },
});
