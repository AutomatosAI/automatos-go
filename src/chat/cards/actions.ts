// What acting on Auto's cards sends and what a refusal says (D-CARDS), pure. The payloads are the
// web's: 'File it' is components/chatbot/mission-suggestion-card.tsx's POST /api/missions; Approve
// sends the empty body MissionApproveRequest accepts (extra=forbid: anything else is a 422); Reject
// needs the reason MissionRejectRequest requires (1-2000 characters), refused here before any call.
// Who may act is src/auth/role.ts (D16, D17): a viewer sees the card read-only with the D17 words
// and never a button the server would refuse. A refusal shows the server's own sentence only when
// it is one a person wrote for people; otherwise, and always for a status, the taxonomy's words. A
// grant's refusal (api/approval_grants.py answers 422 for a card that can no longer run) also says
// what a decided card was decided as, and keeps a sentence that names its expiry time.

import { ApiError, isApiError, userMessage, type ApiErrorKind } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { roleCan, type RoleAction } from '../../auth/role';
import { ROLE_COPY } from '../../auth/strings';
import { CONTEXT_MESSAGES_KEPT } from '../../core/web/lib/chat/suggestion';
import { CARD_COPY, GRANT_COPY } from '../strings';

/** MissionCreateRequest.goal (api/missions.py). */
export const MISSION_GOAL_MAX_CHARS = 10_000;
/** MissionRejectRequest.reason (api/missions.py). */
export const REJECT_REASON_MAX_CHARS = 2000;

/** One message of the Mission's context, as the web's recentMessages builds it. */
export type ContextMessage = { readonly role: string; readonly content: string };

export type MissionCreateBody = {
  readonly goal: string;
  readonly config: {
    readonly source: 'chat';
    /** The launching chat: the Mission narrates back into it (PRD-227); none for a draft. */
    readonly chat_id?: string;
    readonly context_messages?: readonly ContextMessage[];
  };
};

export type RejectBody = { readonly reason: string };

/** 'File it': the suggestion's goal, the chat, and the newest five messages (when there are any). */
export function missionCreateBody(
  goal: string,
  chatId: string | null,
  context: readonly ContextMessage[],
): MissionCreateBody {
  const recent = context.slice(-CONTEXT_MESSAGES_KEPT);
  return {
    goal: goal.trim().slice(0, MISSION_GOAL_MAX_CHARS),
    config: {
      source: 'chat',
      ...(chatId ? { chat_id: chatId } : {}),
      ...(recent.length > 0 ? { context_messages: recent } : {}),
    },
  };
}

/** Approve's body: always empty (plan edits are Studio's, PATCH /api/missions/{id}/plan). */
export function approveBody(): Readonly<Record<string, never>> {
  return {};
}

/** Why a reason cannot be sent yet, or null when it can. */
export function rejectReasonError(reason: string): string | null {
  const words = reason.trim();
  if (!words) return CARD_COPY.reasonRequired;
  return words.length > REJECT_REASON_MAX_CHARS
    ? CARD_COPY.reasonTooLong(REJECT_REASON_MAX_CHARS)
    : null;
}

/** Reject's body, or null while the reason is blank or too long (nothing is sent). */
export function rejectBody(reason: string): RejectBody | null {
  return rejectReasonError(reason) === null ? { reason: reason.trim() } : null;
}

/** Owners, admins and editors act on a card; anyone else, and an unknown role, cannot. */
export function canAct(role: WorkspaceRole | null | undefined, action: RoleAction = 'approve') {
  return roleCan(role, action);
}

export type CardAccess = {
  readonly canAct: boolean;
  /** The D17 words under a card the role cannot act on; null when it can. */
  readonly note: string | null;
};

export function cardAccess(
  role: WorkspaceRole | null | undefined,
  action: RoleAction = 'approve',
): CardAccess {
  const allowed = canAct(role, action);
  return { canAct: allowed, note: allowed ? null : ROLE_COPY.viewerReadOnly };
}

/** The refusals whose words may be the server's own (403, 409, and a 400 or 422 'server'). */
const REFUSAL_KINDS: ReadonlySet<ApiErrorKind> = new Set(['forbidden', 'conflict', 'server']);
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([400, 403, 409, 422]);

/** A sentence: a capital first, an end stop last, one line. */
const SENTENCE = /^[A-Z][^\n]*[.!?]$/;
/** Words a person did not write: identifiers, ids, code, an arrow, a quoted enum, a scope. */
const INTERNALS =
  /[_{}[\]<>=\\|`→]|\w:\w|\b[0-9a-f]{8}-[0-9a-f]{4}|\b[0-9a-f]{12,}\b|'\w+'|\bentity\b/i;
/** D-NO-BILLING: anything that may name a plan, a price or credits never reaches the screen. */
const BILLING =
  /credit|pric|billing|subscri|upgrad|trial|quota|payment|invoice|[$€£]|\b(free|pro|paid|team|business|enterprise|starter)\s+plan\b/i;

/** Whether the server's words are a sentence written for people (and say nothing about money). */
export function isUserSentence(text: string | undefined): boolean {
  if (text === undefined) return false;
  const words = text.trim();
  return SENTENCE.test(words) && !INTERNALS.test(words) && !BILLING.test(words);
}

function mayShowServerWords(error: ApiError): boolean {
  const refusal =
    REFUSAL_KINDS.has(error.kind) &&
    error.status !== undefined &&
    REFUSAL_STATUSES.has(error.status);
  return refusal && isUserSentence(error.serverMessage);
}

/** What a failed card action says: the server's sentence where it is one, else the taxonomy's. */
export function refusalText(error: unknown): string {
  if (!isApiError(error)) return userMessage(error);
  if (mayShowServerWords(error)) return (error.serverMessage ?? '').trim();
  // the taxonomy by kind, never the server's words (userMessage shows a conflict's own)
  return userMessage(new ApiError(error.kind, { status: error.status, code: error.code }));
}

/** /grant and /deny refuse a card that can no longer run with a 422 (a 409 from a later server). */
const GRANT_REFUSALS: ReadonlySet<number> = new Set([409, 422]);
/** approval_grant_lapses.py NOT_PENDING and the /deny refusal: the server's words for a decided card. */
const NOT_PENDING = /^Grant is not pending \(status: ([a-z_]+)\)\.?$/;
/** A clock time ('expired at 05:12 on 15 Oct') is a person's words, not an identifier. */
const CLOCK = /\b\d{1,2}:\d{2}\b/g;

function alreadyDecided(status: string): string {
  const words = GRANT_COPY.alreadyDecided;
  return Object.prototype.hasOwnProperty.call(words, status)
    ? words[status]
    : GRANT_COPY.alreadyAnswered;
}

/**
 * What a refused grant or deny says: a decided card in the kit's words for its status, the server's
 * sentence when a person wrote it (expired, replaced, already decided), else refusalText's.
 */
export function grantRefusalText(error: unknown): string {
  const refused =
    isApiError(error) && error.status !== undefined && GRANT_REFUSALS.has(error.status);
  if (!refused) return refusalText(error);
  const words = (error.serverMessage ?? '').trim();
  const decided = NOT_PENDING.exec(words);
  if (decided) return alreadyDecided(decided[1]);
  return isUserSentence(words.replace(CLOCK, '')) ? words : refusalText(error);
}
