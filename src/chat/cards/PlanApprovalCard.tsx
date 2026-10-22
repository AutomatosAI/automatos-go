// A Mission plan waiting for approval (the mission_approval card; the web's MissionApprovalWidget,
// drawn as the handoff's Mission card): the goal, the task count, the oversight note (PRD-181 S5),
// and the numbered tasks with the agent each runs on. Approve & run sends the empty body; Reject
// first asks why, and sends nothing until there is a reason. Decided, it says how. A role that
// cannot decide reads it with the D17 words. No cost or ceiling is shown (D8); plan edits and the
// Face ID step (A4) are not here.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import { joinLabel } from '../../ui/paint';
import { tonePaint } from '../../ui/variants';
import { CARD_COPY } from '../strings';
import { REJECT_REASON_MAX_CHARS, rejectBody, type CardAccess } from './actions';
import { approveMission, rejectMission } from './api';
import { ReadOnlyNote, RefusalText } from './CardNotes';
import type { SettleCard } from './model';
import { MissionFrame } from './MissionFrame';
import { useCardAccess, useCardRequest, type CardRequest } from './use-card-request';
import type { OversightView, PlanRow, PlanTaskRow } from './view';

const ROW_LEVEL = 4;
const NOTE_LEVEL = 6;
const NUMBER_WIDTH = 18;

function OversightNote({ view }: { readonly view: OversightView }) {
  const { colours, radii, spacing } = useTokens();
  const { backgroundColor, color } = tonePaint(colours, 'warning');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={joinLabel(CARD_COPY.oversight, view.title, view.rationale)}
      style={{
        backgroundColor,
        borderRadius: radii.control,
        padding: spacing.space4,
        marginHorizontal: spacing.space6,
        marginBottom: spacing.space4,
        gap: spacing.space1,
      }}
    >
      <Text level={NOTE_LEVEL} weight={600} style={{ color }}>
        {view.title}
      </Text>
      {view.rationale ? (
        <Text level={NOTE_LEVEL} tone="muted">
          {view.rationale}
        </Text>
      ) : null}
    </View>
  );
}

function TaskLine({ task }: { readonly task: PlanTaskRow }) {
  const { colours, spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={task.accessibilityLabel}
      style={[
        styles.task,
        { borderColor: colours.border, paddingHorizontal: spacing.space6, gap: spacing.space1 },
        { paddingVertical: spacing.space3 },
      ]}
    >
      <View style={[styles.row, { gap: spacing.space4 }]}>
        <Text variant="mono" tone="muted" style={styles.number}>
          {task.number}
        </Text>
        <Text level={ROW_LEVEL} style={styles.title}>
          {task.title}
        </Text>
        {task.agent ? (
          <Text variant="mono" tone="muted">
            {task.agent}
          </Text>
        ) : null}
      </View>
      {task.match ? (
        <Text
          level={NOTE_LEVEL}
          tone="muted"
          numberOfLines={2}
          style={{ marginLeft: NUMBER_WIDTH + spacing.space4 }}
        >
          {task.match}
        </Text>
      ) : null}
    </View>
  );
}

type RejectFormProps = {
  readonly request: CardRequest;
  readonly onCancel: () => void;
  readonly onReject: (reason: string) => void;
};

/** Reject asks why first: the send stays off while the reason is blank (rejectBody). */
function RejectForm({ request, onCancel, onReject }: RejectFormProps) {
  const { spacing } = useTokens();
  const [reason, setReason] = useState('');
  const ready = rejectBody(reason) !== null;
  return (
    <>
      <TextField
        label={CARD_COPY.rejectReasonLabel}
        placeholder={CARD_COPY.rejectReasonPlaceholder}
        value={reason}
        onChangeText={setReason}
        maxLength={REJECT_REASON_MAX_CHARS}
        helper={ready ? undefined : CARD_COPY.reasonRequired}
        disabled={request.busy}
        multiline
      />
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button
          label={CARD_COPY.cancel}
          onPress={onCancel}
          size="sm"
          variant="outline"
          disabled={request.busy}
        />
        <Button
          label={CARD_COPY.sendReject}
          onPress={() => onReject(reason)}
          size="sm"
          disabled={!ready}
          busy={request.busy}
        />
      </View>
      <RefusalText text={request.error} />
    </>
  );
}

type FooterProps = {
  readonly card: PlanRow;
  readonly access: CardAccess;
  readonly request: CardRequest;
  readonly onApprove: () => void;
  readonly onReject: (reason: string) => void;
};

function PlanFooter({ card, access, request, onApprove, onReject }: FooterProps) {
  const { spacing } = useTokens();
  const [rejecting, setRejecting] = useState(false);
  if (card.decided) return <ReadOnlyNote text={card.decided} />;
  if (!access.canAct) return <ReadOnlyNote text={access.note} />;
  if (rejecting)
    return (
      <RejectForm request={request} onCancel={() => setRejecting(false)} onReject={onReject} />
    );
  return (
    <>
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button label={CARD_COPY.approve} onPress={onApprove} size="sm" busy={request.busy} />
        <Button
          label={CARD_COPY.reject}
          onPress={() => setRejecting(true)}
          size="sm"
          variant="outline"
          disabled={request.busy}
        />
      </View>
      <RefusalText text={request.error} />
    </>
  );
}

export type PlanApprovalCardProps = {
  readonly card: PlanRow;
  readonly onSettled: SettleCard;
};

export function PlanApprovalCard({ card, onSettled }: PlanApprovalCardProps) {
  const access = useCardAccess('approve');
  const request = useCardRequest(card.key, onSettled);
  const approve = () =>
    request.run(async (client) => {
      await approveMission(client, card.missionId);
      return { state: 'approved' };
    });
  const reject = (reason: string) => {
    const body = rejectBody(reason);
    if (!body) return;
    request.run(async (client) => {
      await rejectMission(client, card.missionId, body);
      return { state: 'rejected' };
    });
  };
  return (
    <MissionFrame
      eyebrow={CARD_COPY.planEyebrow}
      title={card.goal}
      meta={card.summary}
      footer={
        <PlanFooter
          card={card}
          access={access}
          request={request}
          onApprove={approve}
          onReject={reject}
        />
      }
    >
      {card.oversight ? <OversightNote view={card.oversight} /> : null}
      {card.tasks.map((task) => (
        <TaskLine key={task.key} task={task} />
      ))}
    </MissionFrame>
  );
}

const styles = StyleSheet.create({
  task: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  number: { width: NUMBER_WIDTH },
  title: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
