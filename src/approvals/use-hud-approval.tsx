// HUD's approval sheet, wired (US-G08; the choice is waiting.ts's): the newest card waiting with an
// ApprovalView@1 opens the sheet by itself, once; closed unanswered, a line under the state chip
// ('◆ WAITING FOR YOU · OPEN') opens it again. The answers are the cards' own (Approve & run behind
// Face ID, Deny or Reject never gated), so the thread's record settles as it would from a card.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { PlanApprovalCard } from '../chat/cards/PlanApprovalCard';
import { ToolApprovalCard } from '../chat/cards/ToolApprovalCard';
import type { SettleCard } from '../chat/cards/model';
import type { ThreadState } from '../chat/controller/thread';
import { threadRows } from '../chat/view-model';
import { Button } from '../ui';
import { APPROVAL_SHEET_COPY } from './strings';
import { waitingSheetCard } from './waiting';

export type HudApproval = {
  /** The sheet, and the way back in once it was closed; nothing while no card waits. */
  readonly line: ReactNode;
};

export function useHudApproval(state: ThreadState, onSettled: SettleCard): HudApproval {
  const card = useMemo(() => waitingSheetCard(threadRows(state)), [state]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const key = card?.key ?? null;
  const close = useCallback(() => {
    if (key) setClosed((current) => new Set([...current, key]));
  }, [key]);
  const reopen = useCallback(() => {
    if (key) setClosed((current) => new Set([...current].filter((each) => each !== key)));
  }, [key]);
  if (!card) return { line: null };
  const sheet = { open: !closed.has(card.key), onClose: close };
  const answer =
    card.kind === 'tool' ? (
      <ToolApprovalCard key={card.key} card={card} onSettled={onSettled} sheet={sheet} />
    ) : (
      <PlanApprovalCard key={card.key} card={card} onSettled={onSettled} sheet={sheet} />
    );
  return {
    line: (
      <>
        {sheet.open ? null : (
          <View style={{ alignSelf: 'center' }}>
            <Button
              label={APPROVAL_SHEET_COPY.hudOpen}
              accessibilityLabel={APPROVAL_SHEET_COPY.hudOpenLabel}
              onPress={reopen}
              variant="outline"
              size="sm"
            />
          </View>
        )}
        {answer}
      </>
    ),
  };
}
