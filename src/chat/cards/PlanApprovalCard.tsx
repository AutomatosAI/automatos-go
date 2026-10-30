// A Mission plan waiting for approval (the mission_approval card; the web's MissionApprovalWidget,
// drawn as the handoff's Mission card): the goal, the task count, the oversight note (PRD-181 S5),
// and the numbered tasks with the agent each runs on. Approve & run sends the empty body; Reject
// first asks why, and sends nothing until there is a reason. Decided, it says how; a plan someone
// already decided elsewhere says so when the server refuses (planRefusalText). A role that
// cannot decide reads it with the D17 words. No cost or ceiling is shown (D8); plan edits are not
// here. Approve & run asks for Face ID first (gated.ts, A4); Reject never does (KP13).
// Where the card carries ApprovalView@1 (PRD-268 US-G08) it stays the record (D30) and a tap opens the
// answer sheet (src/approvals/ApprovalSheet.tsx), where Reject asks its reason in place; HUD, which
// draws no thread cards, mounts the sheet alone (`sheet`). Without a view it is today's card.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApprovalSheet } from '../../approvals/ApprovalSheet';
import { APPROVAL_SHEET_COPY } from '../../approvals/strings';
import { useStepUp } from '../../step-up/use-step-up';
import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import { CARD_COPY } from '../strings';
import { REJECT_REASON_MAX_CHARS, planRefusalText, rejectBody, type CardAccess } from './actions';
import { rejectMission } from './api';
import { ReadOnlyNote, RefusalText } from './CardNotes';
import { approvePlanGated } from './gated';
import type { SettleCard } from './model';
import { MissionFrame } from './MissionFrame';
import { OversightNote } from './OversightNote';
import type { SheetOnly } from './ToolApprovalCard';
import { useCardAccess, useCardRequest, type CardRequest } from './use-card-request';
import type { PlanRow, PlanTaskRow } from './view';

const ROW_LEVEL = 4;
const NOTE_LEVEL = 6;
const NUMBER_WIDTH = 18;

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
  /** Draw only the answer sheet (HUD); absent, the card in the thread. */
  readonly sheet?: SheetOnly;
};

type PlanSheetProps = {
  readonly card: PlanRow;
  readonly request: CardRequest;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onApprove: () => void;
  readonly onReject: (reason: string) => void;
};

/** The plan's answer sheet: Approve & run, or Reject with its reason asked in place. */
function PlanSheet({ card, request, visible, onClose, onApprove, onReject }: PlanSheetProps) {
  const [rejecting, setRejecting] = useState(false);
  if (!card.view) return null;
  const close = () => {
    setRejecting(false);
    onClose();
  };
  return (
    <ApprovalSheet
      visible={visible}
      onClose={close}
      view={card.view}
      kind="plan"
      busy={request.busy}
      error={request.error}
      onAllow={onApprove}
      onRefuse={() => setRejecting(true)}
      refuseForm={
        rejecting ? (
          <RejectForm request={request} onCancel={() => setRejecting(false)} onReject={onReject} />
        ) : undefined
      }
    />
  );
}

/** The plan's two writes: Approve & run behind Face ID, Reject with its reason (never gated). */
function usePlanAnswers(card: PlanRow, request: CardRequest) {
  const { guard } = useStepUp();
  const approve = () => request.run(approvePlanGated(guard, card.missionId));
  const reject = (reason: string) => {
    const body = rejectBody(reason);
    if (!body) return;
    request.run(async (client) => {
      await rejectMission(client, card.missionId, body);
      return { state: 'rejected' };
    });
  };
  return { approve, reject };
}

function PlanFrame({ card, footer }: { readonly card: PlanRow; readonly footer: ReactNode }) {
  return (
    <MissionFrame
      eyebrow={CARD_COPY.planEyebrow}
      title={card.goal}
      meta={card.summary}
      footer={footer}
    >
      {card.oversight ? <OversightNote view={card.oversight} /> : null}
      {card.tasks.map((task) => (
        <TaskLine key={task.key} task={task} />
      ))}
    </MissionFrame>
  );
}

type ReviewableProps = {
  readonly card: PlanRow;
  readonly request: CardRequest;
  readonly answers: ReturnType<typeof usePlanAnswers>;
};

/** The record in the thread (D30): a tap, or Review and answer, opens the sheet. */
function ReviewablePlan({ card, request, answers }: ReviewableProps) {
  const [open, setOpen] = useState(false);
  const footer = (
    <View style={styles.start}>
      <Button
        label={APPROVAL_SHEET_COPY.review}
        onPress={() => setOpen(true)}
        size="sm"
        accessibilityHint={APPROVAL_SHEET_COPY.reviewHint}
      />
    </View>
  );
  return (
    <>
      {/* a tap anywhere opens the sheet; VoiceOver keeps the card's parts and its own button */}
      <Pressable accessible={false} onPress={() => setOpen(true)}>
        <PlanFrame card={card} footer={footer} />
      </Pressable>
      <PlanSheet
        card={card}
        request={request}
        visible={open}
        onClose={() => setOpen(false)}
        onApprove={answers.approve}
        onReject={answers.reject}
      />
    </>
  );
}

export function PlanApprovalCard({ card, onSettled, sheet }: PlanApprovalCardProps) {
  const access = useCardAccess('approve');
  const request = useCardRequest(card.key, onSettled, planRefusalText);
  const answers = usePlanAnswers(card, request);
  const inSheet = card.view !== null && card.decided === null && access.canAct;
  if (sheet) {
    if (!inSheet) return null;
    return (
      <PlanSheet
        card={card}
        request={request}
        visible={sheet.open}
        onClose={sheet.onClose}
        onApprove={answers.approve}
        onReject={answers.reject}
      />
    );
  }
  if (inSheet) return <ReviewablePlan card={card} request={request} answers={answers} />;
  const footer = (
    <PlanFooter
      card={card}
      access={access}
      request={request}
      onApprove={answers.approve}
      onReject={answers.reject}
    />
  );
  return <PlanFrame card={card} footer={footer} />;
}

const styles = StyleSheet.create({
  task: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  number: { width: NUMBER_WIDTH },
  title: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
});
