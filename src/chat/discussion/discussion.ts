// 'Ask Auto about #0419' (D-ASK-AUTO, D31), pure: the web's Discuss over the vendored
// lib/discussion.ts. routes.chatWithTicket opens a NEW conversation (a draft) with the ticket's
// row id in the link; once the ticket has loaded, every message of that conversation carries
// discussionSelection(discussionOf(ticket)) as the page context's `selected`, so Auto reads the
// ticket before it answers (services/page_context.py). Until the ticket is in (or while it failed
// to load for a reason other than not being there) the composer holds the send, so no message about
// the ticket goes out without it; End lets go of it. The bar offers 'Update ticket and re-queue' to
// a role that may approve (D16, D17); on a Mission's ticket it points at the Mission in Studio
// instead, where the plan is decided (PRD-252 D4). The rebrief sheet opens on the brief Auto
// proposed in its last reply (proposedBrief, capped at MAX_BRIEF_CHARS), which the owner edits.

import { isApiError } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import {
  MAX_BRIEF_CHARS,
  discussionOf,
  discussionSelection,
  proposedBrief,
  type Discussion,
} from '../../core/web/lib/discussion';
import { missionHref } from '../../core/web/lib/ticket-links';
import { ticketCalled } from '../../core/web/lib/ticket-number';
import type { ChatMessage } from '../../core/web/types';
import type { BoardTask } from '../../core/web/types/board';
import { routes, ticketFromChatParams, type RouteParams } from '../../navigation/routes';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';
import { errorCopy } from '../../ui/variants';
import type { ChatRequestInput } from '../request';
import { routeChatId } from '../screens/chat-route';
import { DISCUSSION_COPY } from '../strings';
import type { RebriefBody } from './ticket';

export { MAX_BRIEF_CHARS } from '../../core/web/lib/discussion';

/** The ticket a route discusses: a draft's ticket param (a conversation already named has none). */
export function routeTicketId(params: RouteParams): string | null {
  return routeChatId(params) === null ? ticketFromChatParams(params) : null;
}

/** Where the ticket stands: no discussion, loading it, or its answer (the ticket or the failure). */
export type DiscussionLoad = {
  /** The ticket's row id from the link; null when the conversation discusses nothing. */
  readonly ticketId: string | null;
  readonly ticket: BoardTask | undefined;
  readonly error: unknown;
};

/** The discussion once the ticket is in; null before, after a failure, and with no ticket. */
export function discussionFrom(load: DiscussionLoad): Discussion | null {
  return load.ticketId !== null && load.ticket ? discussionOf(load.ticket) : null;
}

/** A 404: this workspace has no such ticket (another workspace's, or gone). */
export function isMissingTicket(error: unknown): boolean {
  return isApiError(error) && error.kind === 'not_found';
}

/** The send waits while the ticket loads or failed to load; a missing ticket lets the chat go on. */
export function discussionHolds(load: DiscussionLoad): boolean {
  if (load.ticketId === null || load.ticket) return false;
  return !isMissingTicket(load.error);
}

/** One message as the thread takes it (use-thread.ts ThreadSendInput). */
export type DiscussionMessage = Omit<ChatRequestInput, 'chatId'>;

/** The message as the thread sends it: with the discussion's ticket (or Mission) selected. */
export function discussionInput(
  input: DiscussionMessage,
  discussion: Discussion | null,
): DiscussionMessage {
  if (!discussion) return input;
  return { ...input, context: { ...input.context, selected: discussionSelection(discussion) } };
}

/** What the bar offers: the rebrief, the Mission in Studio (null: no web URL), or nothing. */
export type DiscussionAction =
  | { readonly kind: 'rebrief' }
  | { readonly kind: 'mission'; readonly target: WebLinkTarget | null }
  | { readonly kind: 'none' };

export type DiscussionBarView =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string }
  | { readonly kind: 'failed'; readonly text: string; readonly canRetry: boolean }
  | {
      readonly kind: 'open';
      readonly title: string;
      /** The ticket's own sheet (routes.cc.ticket): every ticket reference opens it. */
      readonly ticketRoute: string;
      readonly action: DiscussionAction;
    };

export type DiscussionBarOptions = {
  readonly role: WorkspaceRole | null | undefined;
  /** Studio's base URL for the Mission's page (EXPO_PUBLIC_WEB_URL by default). */
  readonly webUrl?: string;
};

function actionOf(discussion: Discussion, options: DiscussionBarOptions): DiscussionAction {
  if (discussion.missionId) {
    return {
      kind: 'mission',
      target: appRouteForWebLink(missionHref(discussion.missionId), options.webUrl),
    };
  }
  return roleCan(options.role, 'approve') ? { kind: 'rebrief' } : { kind: 'none' };
}

function failedView(load: DiscussionLoad, ticketId: string): DiscussionBarView {
  if (isMissingTicket(load.error))
    return { kind: 'missing', text: DISCUSSION_COPY.missing(ticketId) };
  const copy = errorCopy(load.error);
  return { kind: 'failed', text: copy.message, canRetry: copy.canRetry };
}

/** The bar over the conversation, by where the ticket stands. */
export function discussionBar(
  load: DiscussionLoad,
  options: DiscussionBarOptions,
): DiscussionBarView {
  const { ticketId } = load;
  if (ticketId === null) return { kind: 'none' };
  const discussion = discussionFrom(load);
  if (!discussion) {
    return load.error
      ? failedView(load, ticketId)
      : { kind: 'loading', text: DISCUSSION_COPY.opening };
  }
  return {
    kind: 'open',
    title: DISCUSSION_COPY.discussing(discussion.number, discussion.title),
    ticketRoute: routes.cc.ticket(discussion.ticketId),
    action: actionOf(discussion, options),
  };
}

/** 'ticket #0419' (capital: 'Ticket #0419'), or 'this ticket' when it has no number. */
export function ticketWords(discussion: Discussion, capital = false): string {
  return ticketCalled({ number: discussion.number }, capital);
}

function agentWords(discussion: Discussion): string {
  return discussion.agentName ?? DISCUSSION_COPY.itsAgent;
}

export type RebriefSheetCopy = { readonly title: string; readonly intro: string };

export function rebriefSheetCopy(discussion: Discussion): RebriefSheetCopy {
  return {
    title: DISCUSSION_COPY.sheetTitle(ticketWords(discussion)),
    intro: DISCUSSION_COPY.sheetIntro(agentWords(discussion)),
  };
}

/** The toast once the ticket is back with its agent. */
export function rebriefDoneText(discussion: Discussion): string {
  return DISCUSSION_COPY.saved(ticketWords(discussion, true), agentWords(discussion));
}

/** The sheet's first words: the brief Auto proposed in its last reply (its fenced block), capped. */
export function rebriefPrefill(messages: readonly ChatMessage[]): string {
  return proposedBrief([...messages]);
}

/** The rebrief's body, or null while the brief is blank or over the server's bound. */
export function rebriefBody(brief: string): RebriefBody | null {
  const words = brief.trim();
  return words && words.length <= MAX_BRIEF_CHARS ? { brief: words } : null;
}

/** Save is offered to a role that may approve, once there is a brief to send. */
export function canRebrief(role: WorkspaceRole | null | undefined, brief: string): boolean {
  return roleCan(role, 'approve') && rebriefBody(brief) !== null;
}
