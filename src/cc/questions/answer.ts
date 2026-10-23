// Answering and dismissing a question, pure (D-QUESTIONS, D-WRITES, D-ROLES). The body is an option
// exactly as offered ({option}: the server matches it against the grant's options, 422 otherwise) or
// the person's own words ({answer_text}, trimmed; blank is refused unsent). Who may answer is
// roleCan 'answer'. The toast says only what the server's answer shows: 'Answered.', or that the
// question was already answered or dismissed (the answer route cannot tell whether the agent
// resumed, lead 21 Oct). A dismiss says what it did: a stopped run's question closes its run.

import { isApiError, userMessage } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { QUESTIONS_COPY } from '../strings';
import type { DecisionResult, Questions } from './schemas';

export type AnswerChoice =
  | { readonly kind: 'option'; readonly option: string }
  | { readonly kind: 'words'; readonly text: string };

export type AnswerBody = { readonly option: string } | { readonly answer_text: string };

export type AnswerRefusal = 'empty' | 'not_offered';

export type AnswerCheck =
  | { readonly ok: true; readonly body: AnswerBody }
  | { readonly ok: false; readonly reason: AnswerRefusal; readonly message: string };

const EMPTY: AnswerCheck = Object.freeze({
  ok: false,
  reason: 'empty',
  message: QUESTIONS_COPY.answerEmpty,
});

/** The words the server records (it strips the answer before it keeps it). */
export function spokenWords(choice: AnswerChoice): string {
  return (choice.kind === 'option' ? choice.option : choice.text).trim();
}

/** The body for this choice, or why it cannot be sent: blank, or not one of the offered options. */
export function answerBody(choice: AnswerChoice, offered: readonly string[]): AnswerCheck {
  if (!spokenWords(choice)) return EMPTY;
  if (choice.kind === 'words') return { ok: true, body: { answer_text: choice.text.trim() } };
  if (!offered.includes(choice.option)) {
    return { ok: false, reason: 'not_offered', message: QUESTIONS_COPY.notOffered };
  }
  return { ok: true, body: { option: choice.option } };
}

/** An answer refused before it was sent: the words are for the screen. */
export class AnswerInputError extends Error {
  readonly reason: AnswerRefusal;

  constructor(reason: AnswerRefusal, message: string) {
    super(message);
    this.name = 'AnswerInputError';
    this.reason = reason;
  }
}

export function isAnswerInputError(error: unknown): error is AnswerInputError {
  return error instanceof AnswerInputError;
}

/** Owners, admins and editors answer and dismiss; viewers, and a role not yet known, do not. */
export function mayAnswer(role: WorkspaceRole | null | undefined): boolean {
  return roleCan(role, 'answer');
}

/** A known role that may not answer reads the questions with this reason (D-ROLES). */
export function readOnlyReason(role: WorkspaceRole | null | undefined): string | null {
  return role && !mayAnswer(role) ? QUESTIONS_COPY.readOnly : null;
}

const GRANTED = 'granted';
const DENIED = 'denied';

/**
 * The toast after /answer. A compare-and-swap loser is answered 200 with the winner's row
 * (approval_grants.py apply_question_answer): another answer recorded, or a dismiss, says so.
 */
export function answeredMessage(result: DecisionResult | undefined, choice: AnswerChoice): string {
  const grant = result?.grant;
  if (grant?.status === DENIED) return QUESTIONS_COPY.alreadyDismissed;
  const recorded = grant?.answer_text?.trim();
  return recorded && recorded !== spokenWords(choice)
    ? QUESTIONS_COPY.alreadyAnswered
    : QUESTIONS_COPY.answered;
}

/** The toast after /deny: the run closed, or the ticket left blocked for a re-ask. */
export function dismissedMessage(stoppedRun: boolean): string {
  return stoppedRun ? QUESTIONS_COPY.dismissed.stoppedRun : QUESTIONS_COPY.dismissed.blocked;
}

/** What dismissing will do, said before it is sent. */
export function dismissEffect(stoppedRun: boolean): string {
  return stoppedRun
    ? QUESTIONS_COPY.dismissEffect.stoppedRun
    : QUESTIONS_COPY.dismissEffect.blocked;
}

/** 'Question is not open (status: granted)', 'Grant is not pending (status: denied)'. */
const NOT_OPEN = /\(status: ([a-z_]+)\)/;
const CLOSED_WORDS: Readonly<Record<string, string>> = Object.freeze({
  [GRANTED]: QUESTIONS_COPY.alreadyAnswered,
  [DENIED]: QUESTIONS_COPY.alreadyDismissed,
});

function closedWords(serverMessage: string): string | null {
  const status = NOT_OPEN.exec(serverMessage)?.[1];
  return status && Object.prototype.hasOwnProperty.call(CLOSED_WORDS, status)
    ? CLOSED_WORDS[status]
    : null;
}

/**
 * Why an answer or a dismiss did not go through. A 409 shows the server's words ('was already
 * answered', PRD-266); today a question no longer open is a 422 'not open (status: …)', said as
 * already answered or dismissed, and any other 422 in its own words (an option not offered). A 403
 * (owners and admins only until PRD-266 W1) is the taxonomy's forbidden copy; the rest likewise.
 */
export function refusalMessage(error: unknown): string {
  if (isAnswerInputError(error)) return error.message;
  if (!isApiError(error) || !error.serverMessage) return userMessage(error);
  if (error.status === 409) return error.serverMessage;
  if (error.status === 422) return closedWords(error.serverMessage) ?? error.serverMessage;
  return userMessage(error);
}

/** The list was refused: owners and admins only until PRD-266 W1 (editors too after it). */
export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.kind === 'forbidden';
}

/** The list without one question: the card leaves as soon as the server has answered. */
export function withoutQuestion(list: Questions, grantId: number): Questions {
  return { ...list, grants: list.grants.filter((grant) => grant.id !== grantId) };
}
