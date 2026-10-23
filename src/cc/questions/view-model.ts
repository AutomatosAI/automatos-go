// A question card's words, pure (handoff §2 'Questions', the web's question-card.tsx): who asked, the
// ticket it was asked on as a link (the vendored grant-owner.ts and ticket-links.ts), the question as
// plain paragraphs, the blocked cascade and the offered options. A question about something other
// than a ticket names its subject without a link. Unknown task statuses keep their own word.

import { routes, isTaskId } from '../../navigation/routes';
import { agentLabel, ticketLabel } from '../../core/web/lib/grant-owner';
import { questionTicketId } from '../../core/web/lib/ticket-links';
import { countPhrase } from '../../ui/variants';
import { humanised, statusWord } from '../board/board';
import { QUESTIONS_COPY } from '../strings';
import { dismissEffect } from './answer';
import { plainParagraphs } from './plain';
import type { Question, QuestionCascade } from './schemas';

export type QuestionTicketView = {
  readonly label: string;
  /** The ticket sheet opened at this question, or null for a subject with no app route. */
  readonly href: string | null;
};

export type CascadeRowView = {
  readonly id: number;
  readonly title: string;
  readonly status: string | null;
};

export type CascadeView = {
  /** 'Blocking 2 downstream tasks'. */
  readonly title: string;
  readonly rows: readonly CascadeRowView[];
  /** '+3 more' past the six the server lists, or null. */
  readonly more: string | null;
};

export type QuestionCardView = {
  readonly id: number;
  readonly agent: string;
  readonly ticket: QuestionTicketView | null;
  readonly paragraphs: readonly string[];
  readonly cascade: CascadeView | null;
  readonly options: readonly string[];
  readonly stoppedRun: boolean;
  /** What dismissing will do, said before it is sent. */
  readonly dismissEffect: string;
};

/** The agent's name; else the web's 'Agent #12' or 'An agent'. */
function askedBy(question: Question): string {
  return (
    question.owner?.agent?.name?.trim() || agentLabel(question.owner, question.asked_by_agent_id)
  );
}

function ticketHref(question: Question): string | null {
  const ticketId = questionTicketId({
    subject_type: question.subject_type ?? '',
    subject_id: question.subject_id ?? '',
    owner: question.owner,
  });
  return ticketId && isTaskId(ticketId) ? routes.cc.ticket(ticketId, question.id) : null;
}

/** 'Ticket #0419 · Stripe payouts' linking to the ticket; another subject by its kind, unlinked. */
function ticketView(question: Question): QuestionTicketView | null {
  const label = ticketLabel(question.owner);
  const href = ticketHref(question);
  if (label) return { label, href };
  const subject = question.subject_type?.trim();
  return subject ? { label: humanised(subject), href } : null;
}

export function cascadeView(cascade: QuestionCascade): CascadeView | null {
  if (cascade.total <= 0) return null;
  const rows = cascade.tasks.map((task) => ({
    id: task.id,
    title: task.title?.trim() || QUESTIONS_COPY.untitled,
    status: task.status ? statusWord(task.status) : null,
  }));
  const overflow = cascade.total - rows.length;
  return {
    title: `${QUESTIONS_COPY.blockingWord} ${countPhrase(cascade.total, QUESTIONS_COPY.blocking)}`,
    rows,
    more: overflow > 0 ? QUESTIONS_COPY.more(overflow) : null,
  };
}

export function questionCardView(question: Question): QuestionCardView {
  return {
    id: question.id,
    agent: askedBy(question),
    ticket: ticketView(question),
    paragraphs: plainParagraphs(question.question_md),
    cascade: cascadeView(question.cascade),
    options: question.options,
    stoppedRun: question.stoppedRun,
    dismissEffect: dismissEffect(question.stoppedRun),
  };
}
