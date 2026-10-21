// The bodies of a verdict on a ticket in Review (PRD-252 R2), pure. Approve takes an optional note,
// kept on the ticket; Send back needs words, because they lead the redo's brief (the server's
// send_back strips them and cuts them at MAX_REVIEW_FEEDBACK_CHARS, so a longer note is refused here
// rather than cut off unseen). A refusal is the user's to fix and carries its words; nothing is sent.

import { BOARD_COPY } from '../strings';

/** api/board_tasks.py MAX_REVIEW_FEEDBACK_CHARS at the pinned SHA. */
export const SEND_BACK_MAX_CHARS = 4000;

export type ApproveBody = { readonly note?: string };
export type SendBackBody = { readonly feedback: string };

export type SendBackRefusal = 'empty' | 'too_long';

export type SendBackCheck =
  | { readonly ok: true; readonly body: SendBackBody }
  | { readonly ok: false; readonly reason: SendBackRefusal; readonly message: string };

/** {note} when there are words, {} otherwise (the web's own body: `note ? { note } : {}`). */
export function approveBody(note?: string | null): ApproveBody {
  const words = note?.trim();
  return words ? { note: words } : {};
}

/** The Send back body, or why it cannot be sent (blank, or longer than the server keeps). */
export function sendBackBody(feedback: string | null | undefined): SendBackCheck {
  const words = feedback?.trim() ?? '';
  if (!words) return { ok: false, reason: 'empty', message: BOARD_COPY.feedbackRequired };
  if (words.length > SEND_BACK_MAX_CHARS) {
    return {
      ok: false,
      reason: 'too_long',
      message: BOARD_COPY.feedbackTooLong(SEND_BACK_MAX_CHARS),
    };
  }
  return { ok: true, body: { feedback: words } };
}

/** A verdict refused before it was sent: the words are for the screen. */
export class VerdictInputError extends Error {
  readonly reason: SendBackRefusal;

  constructor(reason: SendBackRefusal, message: string) {
    super(message);
    this.name = 'VerdictInputError';
    this.reason = reason;
  }
}

export function isVerdictInputError(error: unknown): error is VerdictInputError {
  return error instanceof VerdictInputError;
}
