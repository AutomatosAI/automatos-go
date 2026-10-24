// A reply from the notification, sent and read honestly (PRD-001 §4.8, KP8, D-WRITES): POST
// /api/v1/approval-grants/{grant_id}/answer {answer_text} through the one client, once and at once —
// never retried, never queued for later. The route compare-and-swaps pending → granted and a loser
// still gets 200 with the winning grant (mobile-review-main api/approval_grants.py:363-410: the HTTP
// path ignores AnswerOutcome), so 'Answered' needs the grant granted WITH the words this phone sent;
// any other 200, or a 422 (the question is not open any more), is 'already answered'. A 403 or any
// other refusal shows the taxonomy's copy; a network failure, or an id refused before sending, says
// it was not sent. The server strips the answer with Python's str.strip(), which also removes
// U+001C–U+001F and U+0085 that JavaScript's trim() keeps, so the words are compared after both
// strips. Logs carry kinds only, never the words.

import type { ApiClient } from '../../api/client';
import { isApiError, userMessage } from '../../api/errors';
import { logger } from '../../lib/logger';
import { answerQuestion } from '../api';
import { GRANTED_STATUS, UNPROCESSABLE_STATUS } from '../config';
import type { AnswerResult } from '../schemas/server';
import { PUSH_ACTION_COPY } from '../strings';

export type AnswerVerdictKind = 'answered' | 'already_answered' | 'refused' | 'not_sent';

export type AnswerVerdict = Readonly<{ kind: AnswerVerdictKind; toast: string }>;

/** What a reply sends: the grant it answers, the person's words, the ticket's number if signed. */
export type ReplyToSend = Readonly<{ grantId: string; answerText: string; ticketNumber?: string }>;

/** Python's str.strip() whitespace that String.prototype.trim() keeps. */
const PYTHON_ONLY_SPACE: ReadonlySet<number> = new Set([0x1c, 0x1d, 0x1e, 0x1f, 0x85]);
const JS_SPACE = /\s/;
const LEADING_HASHES = /^#+/;

const ALREADY_ANSWERED: AnswerVerdict = Object.freeze({
  kind: 'already_answered',
  toast: PUSH_ACTION_COPY.alreadyAnswered,
});
const NOT_SENT: AnswerVerdict = Object.freeze({
  kind: 'not_sent',
  toast: PUSH_ACTION_COPY.notSent,
});

function isEdgeSpace(char: string | undefined): boolean {
  if (char === undefined) return false;
  return JS_SPACE.test(char) || PYTHON_ONLY_SPACE.has(char.codePointAt(0) ?? -1);
}

/** text without the edge whitespace either JavaScript's trim() or Python's strip() removes. */
export function strippedBothWays(text: string): string {
  const chars = Array.from(text);
  let start = 0;
  let end = chars.length;
  while (start < end && isEdgeSpace(chars[start])) start += 1;
  while (end > start && isEdgeSpace(chars[end - 1])) end -= 1;
  return chars.slice(start, end).join('');
}

/** The recorded words are the words sent (the server stripped them before it kept them). */
export function sameAnswer(sent: string, recorded: string | null): boolean {
  return recorded !== null && strippedBothWays(sent) === strippedBothWays(recorded);
}

/** '#0419' for W2's '#0419' (services/ticket_numbers.py) or a bare '0419'; null without one. */
export function ticketLabel(ticketNumber: string | undefined): string | null {
  const number = ticketNumber?.trim().replace(LEADING_HASHES, '');
  return number ? `#${number}` : null;
}

/** A 200: answered only when the grant is granted with this phone's words. */
export function verdictOfResult(result: AnswerResult, reply: ReplyToSend): AnswerVerdict {
  const { grant } = result;
  if (grant.status !== GRANTED_STATUS || !sameAnswer(reply.answerText, grant.answer_text)) {
    return ALREADY_ANSWERED;
  }
  const toast = PUSH_ACTION_COPY.answered(ticketLabel(reply.ticketNumber));
  return Object.freeze({ kind: 'answered', toast });
}

/** A failure: 422 already answered, network not sent, anything else the taxonomy's words. */
export function verdictOfError(error: unknown): AnswerVerdict {
  // the client turns every failure after sending into an ApiError: anything else was never sent
  if (!isApiError(error)) return NOT_SENT;
  if (error.status === UNPROCESSABLE_STATUS) return ALREADY_ANSWERED;
  if (error.kind === 'network') return NOT_SENT;
  return Object.freeze({ kind: 'refused', toast: userMessage(error) });
}

function kindOf(error: unknown): string {
  return isApiError(error) ? `${error.kind} ${error.status ?? ''}`.trim() : 'unsent';
}

/** Sends the reply once and answers what the server's answer means; never rejects. */
export async function sendAnswer(client: ApiClient, reply: ReplyToSend): Promise<AnswerVerdict> {
  try {
    const result = await answerQuestion(client, reply.grantId, { answer_text: reply.answerText });
    const verdict = verdictOfResult(result, reply);
    logger.info('[push] reply from a notification', verdict.kind);
    return verdict;
  } catch (error) {
    const verdict = verdictOfError(error);
    logger.warn('[push] reply from a notification', verdict.kind, kindOf(error));
    return verdict;
  }
}

/** The question is settled (answered here or before): its notification is read and dismissed. */
export function settlesQuestion(verdict: AnswerVerdict): boolean {
  return verdict.kind === 'answered' || verdict.kind === 'already_answered';
}
