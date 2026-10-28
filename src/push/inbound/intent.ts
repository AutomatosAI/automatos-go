// What a notification response asks for, decided in one pure place (PRD-001 §4.8, D-SIGNATURE,
// KP6, KP7): answer a question, open a screen, or open the app with nothing done. Verification is
// async (src/push/signature), so the caller passes its boolean and the parsed payload; an
// unverified payload is neutral 'unverified' for EVERY action — it posts nothing and follows no
// link — and a verified one is acted on only in the current workspace. Only 'reply', 'open' and
// the tap exist (no Approve, no option buttons: D-LOCK-SCREEN); any other identifier is 'unknown'.
// The category is unsigned and never decides anything: a reply answers only a signed question
// (link_type 'question' with a grant_id). A signed field sent as '' reads as absent.

import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import {
  ANSWER_MAX_CHARS,
  DEFAULT_ACTION_ID,
  OPEN_ACTION_ID,
  QUESTION_LINK_TYPE,
  REPLY_ACTION_ID,
} from '../config';
import type { PushPayload } from '../schemas/payload';
import type { InboundEvent } from './parse';

/** A push's signed link (link_type, link_id); an absent field is left out. */
export type PushLink = Readonly<{ link_type?: string; link_id?: string }>;

export type NeutralReason =
  'unverified' | 'other_workspace' | 'cannot_answer' | 'blank_reply' | 'unknown';

export type PushIntent =
  | Readonly<{
      kind: 'answer';
      grantId: string;
      answerText: string;
      notificationId?: string;
      ticketNumber?: string;
    }>
  | Readonly<{ kind: 'open'; link: PushLink; notificationId?: string }>
  | Readonly<{ kind: 'neutral'; reason: NeutralReason; link?: PushLink }>;

export type IntentInput = Readonly<{
  event: Pick<InboundEvent, 'action' | 'userText'>;
  /** verifyPushSignature's answer for this payload. */
  verified: boolean;
  /** parsePushData's output for event.data; null when it is not a v2 payload. */
  payload: PushPayload | null;
  currentWorkspaceId: string | null;
  role: WorkspaceRole | null;
}>;

/** A signed string field, '' read as absent. */
function present(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

function linkOf(payload: PushPayload): PushLink {
  const link_type = present(payload.link_type);
  const link_id = present(payload.link_id);
  return Object.freeze({ ...(link_type && { link_type }), ...(link_id && { link_id }) });
}

/** The person's reply, trimmed and cut to ANSWER_MAX_CHARS code points (never half a pair). */
export function answerTextOf(userText: string | null): string {
  const trimmed = (userText ?? '').trim();
  return Array.from(trimmed).slice(0, ANSWER_MAX_CHARS).join('').trim();
}

function neutral(reason: NeutralReason, link?: PushLink): PushIntent {
  return Object.freeze({ kind: 'neutral', reason, ...(link && { link }) });
}

function openIntent(payload: PushPayload): PushIntent {
  const notificationId = present(payload.notification_id);
  return Object.freeze({
    kind: 'open',
    link: linkOf(payload),
    ...(notificationId && { notificationId }),
  });
}

function replyIntent(input: IntentInput, payload: PushPayload): PushIntent {
  const grantId = present(payload.grant_id);
  if (payload.link_type !== QUESTION_LINK_TYPE || !grantId) return neutral('unknown');
  const question = linkOf(payload);
  if (!roleCan(input.role, 'answer')) return neutral('cannot_answer', question);
  const answerText = answerTextOf(input.event.userText);
  if (!answerText) return neutral('blank_reply', question);
  const notificationId = present(payload.notification_id);
  const ticketNumber = present(payload.ticket_number);
  return Object.freeze({
    kind: 'answer',
    grantId,
    answerText,
    ...(notificationId && { notificationId }),
    ...(ticketNumber && { ticketNumber }),
  });
}

/**
 * Both name the same workspace. A workspace id is a UUID, whose hex digits mean the same in either
 * case (RFC 9562): the server writes str(uuid) lowercase, but an id is compared as an id, never as
 * text, so a differently cased copy is never read as another workspace.
 */
export function sameWorkspace(first: string | null, second: string | null): boolean {
  if (!first || !second) return false;
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

export function intentFor(input: IntentInput): PushIntent {
  const { payload } = input;
  if (!input.verified || !payload) return neutral('unverified');
  if (!sameWorkspace(payload.workspace_id, input.currentWorkspaceId)) {
    return neutral('other_workspace');
  }
  const { action } = input.event;
  if (action === DEFAULT_ACTION_ID || action === OPEN_ACTION_ID) return openIntent(payload);
  if (action === REPLY_ACTION_ID) return replyIntent(input, payload);
  return neutral('unknown');
}
