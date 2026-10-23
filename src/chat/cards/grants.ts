// What the grant cards send and what they say after (D-CARDS), pure. Approve & run is
// POST /api/v1/approval-grants/{id}/grant and Deny is …/deny, both with no body (the web's
// ToolApprovalWidget); the withdraw offer's Withdraw is that same deny, and Keep it sends nothing
// (withdraw-offer-card.tsx). /grant answers 200 whenever the yes is recorded and the resumed call's
// result rides on the grant, so the approved line says what the click ran, a failure included
// (lib/grant-outcome.ts executedOutcomeLine), never a success the call did not have.

import {
  MARK_DONE,
  MARK_FAILED,
  MARK_MUTED,
  MARK_WAITING,
  type LineTone,
} from '../../core/web/components/play/chat/labels';
import type { GrantRun } from '../schemas';
import { GRANT_COPY } from '../strings';
import { isUserSentence } from './actions';
import { denyApproval, grantApproval } from './api';
import { DENIED, KEPT, WITHDRAWN, type CardCall, type CardOutcome } from './model';

/** lib/grant-outcome.ts: a board ticket's grant re-queues its blocked run instead of resuming a call. */
const BOARD_TASK_REQUEUE = 'board_task_requeue';

/** A card action: a call the server must agree to, or an outcome settled with no call at all. */
export type CardAction =
  | { readonly kind: 'call'; readonly call: CardCall }
  | { readonly kind: 'settle'; readonly outcome: CardOutcome };

/** Approve & run: the grant, then what its resumed call did. */
export function grantCall(grantId: number): CardCall {
  return async (client) => {
    const result = await grantApproval(client, grantId);
    return { state: 'granted', run: result.grant.details?.executed_result ?? null };
  };
}

/** Deny: the action will not run. */
export function denyCall(grantId: number): CardCall {
  return async (client) => {
    await denyApproval(client, grantId);
    return DENIED;
  };
}

export type WithdrawChoice = 'withdraw' | 'keep';

/** Withdraw denies the grant; Keep it settles the request with no call (it still waits). */
export function withdrawAction(choice: WithdrawChoice, grantId: number): CardAction {
  if (choice === 'keep') return { kind: 'settle', outcome: KEPT };
  return {
    kind: 'call',
    call: async (client) => {
      await denyApproval(client, grantId);
      return WITHDRAWN;
    },
  };
}

/** A grant card's state line: a mark in Play's tones and the words that say it (§4.6). */
export type GrantLine = {
  readonly mark: string;
  readonly tone: LineTone;
  readonly text: string;
};

const line = (mark: string, tone: LineTone, text: string): GrantLine => ({ mark, tone, text });

/** The approved line, honest about what ran (executedOutcomeLine in the kit's words). */
export function grantedLine(run: GrantRun | null): GrantLine {
  if (!run) return line(MARK_DONE, 'done', GRANT_COPY.approved);
  if (run.resumed_via === BOARD_TASK_REQUEUE) return line(MARK_DONE, 'done', GRANT_COPY.requeued);
  if (run.requires_confirmation) return line(MARK_WAITING, 'waiting', GRANT_COPY.askedAgain);
  if (run.success) return line(MARK_DONE, 'done', GRANT_COPY.ran);
  const reason = run.error?.trim();
  const text =
    reason && isUserSentence(reason) ? GRANT_COPY.failedBecause(reason) : GRANT_COPY.failed;
  return line(MARK_FAILED, 'failed', text);
}

/** The tool approval's state: waiting for you while open (never failed), then what the click did. */
export function toolLine(outcome: CardOutcome): GrantLine {
  switch (outcome.state) {
    case 'granted':
      return grantedLine(outcome.run);
    case 'denied':
    case 'withdrawn':
      return line(MARK_MUTED, 'muted', GRANT_COPY.denied);
    default:
      return line(MARK_WAITING, 'waiting', GRANT_COPY.waiting);
  }
}

/** A withdraw request's settled words; null while it is open. */
export function withdrawSettled(outcome: CardOutcome): string | null {
  if (outcome.state === 'withdrawn' || outcome.state === 'denied') return GRANT_COPY.withdrawn;
  return outcome.state === 'kept' ? GRANT_COPY.kept : null;
}
