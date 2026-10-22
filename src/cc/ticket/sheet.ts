// The ticket sheet's view, pure (handoff §2 'ticket sheet', D-BOARD, D31): the card's kind row
// (#number, kind, a raised priority, the status as dot and word), the serif title, the agent and
// when it was updated, the description, why it sits in Review or Blocked, the 'Waiting for your
// answer' box when it is blocked on a question (it opens Questions), what it handed in or why it
// failed, and Ask Auto about #number. The card's fields are the Board's own (view-model.ts).

import { DISCUSS_AFTER_REJECTS } from '../../core/web/lib/discussion';
import { isTaskId, routes, type RouteParams } from '../../navigation/routes';
import { reasonChip, reasonSays } from '../board/board';
import type { TicketDetail } from '../board/schemas';
import { ticketCard, type TicketCardView } from '../board/view-model';
import { TICKET_COPY } from '../strings';
import { updatedWord } from './updated';

/** The route's own parameter: app/(app)/cc/ticket/[taskId].tsx. */
export const TASK_ID_PARAM = 'taskId';
/** A long result or failure is cut here on the phone; the whole of it is on the web. */
export const TEXT_CUT_CHARS = 4000;

/** The ticket's row id from the route, or null when it is missing or not digits. */
export function taskIdParam(params: RouteParams): string | null {
  const value = params[TASK_ID_PARAM];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text && isTaskId(text) ? text : null;
}

export type TicketReason = { readonly chip: string; readonly says: string };

export type TicketSheetView = {
  /** The Board's card: kind row, status, title and agent. */
  readonly card: TicketCardView;
  /** 'Ledger · updated 08:06'; the agent alone when the time is unknown. */
  readonly byline: string;
  readonly description: string | null;
  /** Why it is in Review or Blocked; none when the question box says it. */
  readonly reason: TicketReason | null;
  /** Blocked on a question: the box that opens Questions. */
  readonly question: boolean;
  readonly result: string | null;
  readonly failure: string | null;
  readonly ask: { readonly label: string; readonly href: string };
  /** After a few send-backs, a line that suggests talking it through. */
  readonly discussHint: string | null;
};

export type SheetClock = { readonly now: Date; readonly timeZone: string | null };

/** Trimmed text, cut at TEXT_CUT_CHARS; null when blank. */
export function cutText(text: string | null | undefined): string | null {
  const words = text?.trim();
  if (!words) return null;
  return words.length > TEXT_CUT_CHARS
    ? `${words.slice(0, TEXT_CUT_CHARS).trimEnd()}${TICKET_COPY.cut}`
    : words;
}

function isWaitingOnQuestion(ticket: Pick<TicketDetail, 'status' | 'blocked_code'>): boolean {
  return ticket.status === 'blocked' && ticket.blocked_code === 'question';
}

function reasonOf(ticket: TicketDetail): TicketReason | null {
  const chip = reasonChip(ticket);
  const says = reasonSays(ticket);
  return chip && says && !isWaitingOnQuestion(ticket) ? { chip, says } : null;
}

function byline(agentName: string, updated: string | null): string {
  return updated ? `${agentName} · ${TICKET_COPY.updated} ${updated}` : agentName;
}

export function ticketSheetView(ticket: TicketDetail, clock: SheetClock): TicketSheetView {
  const card = ticketCard(ticket);
  const updated = updatedWord(ticket.updated_at ?? ticket.created_at, clock.now, clock.timeZone);
  return {
    card,
    byline: byline(card.agent.name, updated),
    description: ticket.description?.trim() || null,
    reason: reasonOf(ticket),
    question: isWaitingOnQuestion(ticket),
    result: cutText(ticket.result),
    failure: ticket.status === 'failed' ? cutText(ticket.error_message) : null,
    ask: {
      label: card.number ? TICKET_COPY.askAbout(card.number) : TICKET_COPY.askAboutThis,
      href: routes.chatWithTicket(ticket.id),
    },
    discussHint:
      ticket.times_sent_back >= DISCUSS_AFTER_REJECTS
        ? TICKET_COPY.sentBackTimes(ticket.times_sent_back)
        : null,
  };
}
