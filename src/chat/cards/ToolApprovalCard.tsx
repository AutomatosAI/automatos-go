// A tool call waiting for the owner's yes (the tool_approval card; the web's ToolApprovalWidget,
// drawn as the handoff's card): what it asks, the call's name, its permission level, the oversight
// note (PRD-181 S5) and the exact call as key and value lines. Approve & run grants it and says what
// the click ran, a failure included; Deny denies it. While open it says it waits for you, as its
// tool line does, never failed. A role that cannot decide reads it with the D17 words; a click on a
// card someone already decided says what it was decided as (grantRefusalText). Approve & run asks
// for Face ID first (gated.ts, A4); Deny never does (KP13).
// Where the card carries ApprovalView@1 (PRD-268 US-G08) it stays the record (D30) and a tap opens the
// answer sheet (src/approvals/ApprovalSheet.tsx) with the same two answers in today's words; HUD,
// which draws no thread cards, mounts the sheet alone (`sheet`). Without a view it is today's card.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApprovalSheet } from '../../approvals/ApprovalSheet';
import { APPROVAL_SHEET_COPY } from '../../approvals/strings';
import { useStepUp } from '../../step-up/use-step-up';
import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { tint } from '../../ui/paint';
import { MARK_COLOURS } from '../lines';
import { GRANT_COPY } from '../strings';
import { grantRefusalText, type CardAccess } from './actions';
import { ReadOnlyNote, RefusalText } from './CardNotes';
import { grantToolGated } from './gated';
import { denyCall, type GrantLine } from './grants';
import type { SettleCard } from './model';
import { MissionFrame } from './MissionFrame';
import { OversightNote } from './OversightNote';
import { useCardAccess, useCardRequest, type CardRequest } from './use-card-request';
import type { ToolApprovalRow } from './view';

const LINE_LEVEL = 4;
const MARK_WIDTH = 12;
/** The web's digest box: bg-muted/40. */
const PARAMS_TINT = 0.4;

/** The card's state: a mark in Play's tones and its words, one element to screen readers. */
function GrantStatusLine({ line }: { readonly line: GrantLine }) {
  const { colours, spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={line.text}
      style={[styles.row, { gap: spacing.space3 }]}
    >
      <Text variant="mono" style={[styles.mark, { color: colours[MARK_COLOURS[line.tone]] }]}>
        {line.mark}
      </Text>
      <Text level={LINE_LEVEL} style={styles.fill}>
        {line.text}
      </Text>
    </View>
  );
}

function ParamLines({ card }: { readonly card: ToolApprovalRow }) {
  const { colours, radii, spacing } = useTokens();
  if (card.params.length === 0) return null;
  return (
    <View
      style={{
        marginHorizontal: spacing.space6,
        marginBottom: spacing.space4,
        padding: spacing.space3,
        gap: spacing.space1,
        borderRadius: radii.control,
        backgroundColor: tint(colours.muted, PARAMS_TINT),
      }}
    >
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {GRANT_COPY.paramsLabel}
      </Text>
      {card.params.map((param) => (
        <View
          key={param.key}
          accessible
          accessibilityLabel={`${param.key}: ${param.value}`}
          style={[styles.param, { gap: spacing.space3 }]}
        >
          <Text variant="mono" tone="muted">
            {param.key}
          </Text>
          <Text variant="mono" numberOfLines={1} style={styles.fill}>
            {param.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

type FooterProps = {
  readonly card: ToolApprovalRow;
  readonly access: CardAccess;
  readonly request: CardRequest;
};

function ToolFooter({ card, access, request }: FooterProps) {
  const { spacing } = useTokens();
  const { guard } = useStepUp();
  const status = <GrantStatusLine line={card.line} />;
  if (card.decided) return status;
  if (!access.canAct)
    return (
      <>
        {status}
        <ReadOnlyNote text={access.note} />
      </>
    );
  return (
    <>
      {status}
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button
          label={GRANT_COPY.approve}
          onPress={() => request.run(grantToolGated(guard, card.grantId))}
          size="sm"
          busy={request.busy}
        />
        <Button
          label={GRANT_COPY.deny}
          onPress={() => request.run(denyCall(card.grantId))}
          size="sm"
          variant="outline"
          disabled={request.busy}
        />
      </View>
      <RefusalText text={request.error} />
    </>
  );
}

/** HUD's sheet alone: shown while `open`, closed through `onClose`. */
export type SheetOnly = { readonly open: boolean; readonly onClose: () => void };

export type ToolApprovalCardProps = {
  readonly card: ToolApprovalRow;
  readonly onSettled: SettleCard;
  /** Draw only the answer sheet (HUD); absent, the card in the thread. */
  readonly sheet?: SheetOnly;
};

/** The card answers in its sheet: it carries a view, waits, and the role may decide. */
export function answersInSheet(card: Pick<ToolApprovalRow, 'view' | 'decided'>, canAct: boolean) {
  return card.view !== null && !card.decided && canAct;
}

type SheetProps = {
  readonly card: ToolApprovalRow;
  readonly request: CardRequest;
  readonly visible: boolean;
  readonly onClose: () => void;
};

/** The answer sheet: Approve & run behind Face ID, Deny never gated (KP13). */
function ToolSheet({ card, request, visible, onClose }: SheetProps) {
  const { guard } = useStepUp();
  if (!card.view) return null;
  return (
    <ApprovalSheet
      visible={visible}
      onClose={onClose}
      view={card.view}
      kind="tool"
      busy={request.busy}
      error={request.error}
      onAllow={() => request.run(grantToolGated(guard, card.grantId))}
      onRefuse={() => request.run(denyCall(card.grantId))}
    />
  );
}

function ToolFrame({
  card,
  footer,
}: {
  readonly card: ToolApprovalRow;
  readonly footer: ReactNode;
}) {
  return (
    <MissionFrame
      eyebrow={GRANT_COPY.toolEyebrow}
      chip={card.permission}
      title={card.question ?? card.action}
      meta={card.question ? card.action : null}
      footer={footer}
    >
      {card.oversight ? <OversightNote view={card.oversight} /> : null}
      <ParamLines card={card} />
    </MissionFrame>
  );
}

/** The record in the thread (D30): a tap, or Review and answer, opens the sheet. */
function ReviewableCard({
  card,
  request,
}: {
  readonly card: ToolApprovalRow;
  readonly request: CardRequest;
}) {
  const { spacing } = useTokens();
  const [open, setOpen] = useState(false);
  const footer = (
    <View style={{ gap: spacing.space3 }}>
      <GrantStatusLine line={card.line} />
      <View style={styles.start}>
        <Button
          label={APPROVAL_SHEET_COPY.review}
          onPress={() => setOpen(true)}
          size="sm"
          accessibilityHint={APPROVAL_SHEET_COPY.reviewHint}
        />
      </View>
    </View>
  );
  return (
    <>
      {/* a tap anywhere opens the sheet; VoiceOver keeps the card's parts and its own button */}
      <Pressable accessible={false} onPress={() => setOpen(true)}>
        <ToolFrame card={card} footer={footer} />
      </Pressable>
      <ToolSheet card={card} request={request} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ToolApprovalCard({ card, onSettled, sheet }: ToolApprovalCardProps) {
  const access = useCardAccess('approve');
  const request = useCardRequest(card.key, onSettled, grantRefusalText);
  const inSheet = answersInSheet(card, access.canAct);
  if (sheet) {
    if (!inSheet) return null;
    return <ToolSheet card={card} request={request} visible={sheet.open} onClose={sheet.onClose} />;
  }
  if (inSheet) return <ReviewableCard card={card} request={request} />;
  return (
    <ToolFrame card={card} footer={<ToolFooter card={card} access={access} request={request} />} />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  param: { flexDirection: 'row', alignItems: 'baseline' },
  mark: { width: MARK_WIDTH },
  fill: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
});
