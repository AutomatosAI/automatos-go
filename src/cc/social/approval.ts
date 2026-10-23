// What a person can do on a social post awaiting approval, pure (D-SOCIAL, D45, D-ROLES, the web's
// socials-post-review.tsx). Approve sends the content_hash of the version on screen, exactly as the
// post came (D6): never recomputed, never left out. Request changes needs a comment
// (RequestChangesRequest: min_length 1; the service keeps at most COMMENT_MAX_CHARS). Both are offered
// only on a post in Needs approval to a role that may approve (editors hold socials:approve); a
// viewer reads it and is told who decides. A post with no channel would publish nothing, so Approve
// waits for one (F256). A 409 on Approve reloads the post: when the reloaded version or status
// differs from the one approved, it changed and the new one is on screen; otherwise the 409 was a
// refusal of its own (NotPublishable) and shows the server's words.

import { isApiError, userMessage } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { SOCIAL_COPY } from '../strings';
import type { DecidedPost, SocialPost } from './schemas';
import { NEEDS_APPROVAL, statusWord } from './view';

/** modules/socials/service.py COMMENT_MAX_CHARS at the pinned SHA. */
export const SOCIAL_COMMENT_MAX_CHARS = 2000;

const CONFLICT = 409;
/** 409 a refusal in words (IllegalTransition, NotPublishable); 422 unsourced claims, a bad comment. */
const REFUSALS_IN_WORDS: ReadonlySet<number> = new Set([CONFLICT, 422]);

type DecisionFields = Pick<SocialPost, 'status' | 'targets'>;

export type SocialActions = {
  readonly approve: boolean;
  readonly requestChanges: boolean;
};

/** Which decisions the sheet offers on this post to this role. */
export function socialActions(
  post: DecisionFields,
  role: WorkspaceRole | null | undefined,
): SocialActions {
  const decides = post.status === NEEDS_APPROVAL && roleCan(role, 'approve');
  return { approve: decides && post.targets.length > 0, requestChanges: decides };
}

/** A post in Needs approval that this role may not decide: the sheet says who does (D-ROLES). */
export function readOnlyNote(
  post: Pick<SocialPost, 'status'>,
  role: WorkspaceRole | null | undefined,
): string | null {
  return post.status === NEEDS_APPROVAL && role && !roleCan(role, 'approve')
    ? SOCIAL_COPY.readOnly
    : null;
}

/** A post past (or not yet at) Needs approval: nothing waits on anyone here. */
export function settledNote(post: Pick<SocialPost, 'status'>): string | null {
  return post.status === NEEDS_APPROVAL ? null : SOCIAL_COPY.notAwaiting(statusWord(post.status));
}

/** F256: a post that waits on a decider and has no channel says why Approve is missing. */
export function noChannelNote(
  post: DecisionFields,
  role: WorkspaceRole | null | undefined,
): string | null {
  return post.status === NEEDS_APPROVAL && roleCan(role, 'approve') && post.targets.length === 0
    ? SOCIAL_COPY.noChannel
    : null;
}

export type ApproveBody = { readonly content_hash: string };

/** The version on screen, by its hash as the server sent it: nothing else is sent. */
export function approveBody(shown: Pick<SocialPost, 'content_hash'>): ApproveBody {
  return { content_hash: shown.content_hash };
}

export type CommentRefusal = 'empty' | 'too_long';

export type CommentCheck =
  | { readonly ok: true; readonly body: { readonly comment: string } }
  | { readonly ok: false; readonly reason: CommentRefusal; readonly message: string };

/** The Request changes body, or why it cannot be sent (blank, or longer than the server keeps). */
export function requestChangesBody(comment: string | null | undefined): CommentCheck {
  const words = comment?.trim() ?? '';
  if (!words) return { ok: false, reason: 'empty', message: SOCIAL_COPY.commentRequired };
  if (words.length > SOCIAL_COMMENT_MAX_CHARS) {
    return {
      ok: false,
      reason: 'too_long',
      message: SOCIAL_COPY.commentTooLong(SOCIAL_COMMENT_MAX_CHARS),
    };
  }
  return { ok: true, body: { comment: words } };
}

/** A request refused before it was sent: the words are for the screen. */
export class CommentInputError extends Error {
  readonly reason: CommentRefusal;

  constructor(reason: CommentRefusal, message: string) {
    super(message);
    this.name = 'CommentInputError';
    this.reason = reason;
  }
}

export function isCommentInputError(error: unknown): error is CommentInputError {
  return error instanceof CommentInputError;
}

export function isConflict(error: unknown): boolean {
  return isApiError(error) && error.status === CONFLICT;
}

type Version = Pick<SocialPost, 'content_hash' | 'status'>;

/** After a 409 and a reload: 'it changed' unless the reload is the very version approved. */
export function conflictWords(
  approved: Version,
  reloaded: Version | null | undefined,
  error: unknown,
): string {
  const same =
    !!reloaded &&
    reloaded.content_hash === approved.content_hash &&
    reloaded.status === approved.status;
  const said = isApiError(error) ? error.serverMessage?.trim() : undefined;
  return same && said ? said : SOCIAL_COPY.changed;
}

/** Why a decision did not go through: the comment's own words, the server's, or the taxonomy's. */
export function refusalMessage(error: unknown): string {
  if (isCommentInputError(error)) return error.message;
  if (isApiError(error) && error.serverMessage && REFUSALS_IN_WORDS.has(error.status ?? 0)) {
    return error.serverMessage;
  }
  return userMessage(error);
}

/** The toast after Approve: a post whose slot was ahead is scheduled by it. */
export function approvedMessage(result: DecidedPost | undefined): string {
  return result?.status === 'scheduled' ? SOCIAL_COPY.approvedScheduled : SOCIAL_COPY.approved;
}

/** The line above Approve: what approving this exact version does. */
export function approveEffect(slot: string | null): string {
  return slot ? SOCIAL_COPY.effect.slot(slot) : SOCIAL_COPY.effect.noSlot;
}

// ── The verdict panel ───────────────────────────────────────────────────────────────────────

/** Idle shows Request changes and Approve; Request changes opens the comment, which needs words. */
export type SocialVerdictMode = 'idle' | 'comment';

export type VerdictButton = { readonly label: string; readonly disabled: boolean };

export type SocialVerdictView = {
  readonly comment: { readonly open: boolean; readonly error: string | null };
  /** Left: Request changes (opens the comment) or Cancel; null when it is not offered. */
  readonly secondary: VerdictButton | null;
  /** Right: Approve, or Send request while the comment is open; null when neither is offered. */
  readonly primary: VerdictButton | null;
};

function commentError(comment: string): string | null {
  if (!comment.trim()) return null; // blank is a disabled button, not an error before any words
  const checked = requestChangesBody(comment);
  return checked.ok ? null : checked.message;
}

/** The buttons and comment for this mode; while a call is out, every control is disabled. */
export function socialVerdictView(
  actions: SocialActions,
  mode: SocialVerdictMode,
  comment: string,
  busy: boolean,
): SocialVerdictView {
  if (mode === 'comment' && actions.requestChanges) {
    return {
      comment: { open: true, error: commentError(comment) },
      secondary: { label: SOCIAL_COPY.cancel, disabled: busy },
      primary: { label: SOCIAL_COPY.send, disabled: busy || !requestChangesBody(comment).ok },
    };
  }
  return {
    comment: { open: false, error: null },
    secondary: actions.requestChanges
      ? { label: SOCIAL_COPY.requestChanges, disabled: busy }
      : null,
    primary: actions.approve ? { label: SOCIAL_COPY.approve, disabled: busy } : null,
  };
}
