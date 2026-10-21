// The head's lede and the tabs' figures, pure (handoff §2 Head, D26): '1 agent working, 5 in queue,
// 6 need your eyes.' The needs clause is the server's needs-you total as served (useNeedsYou, the one
// number the Command Centre button shows), never recomputed here. The working and queued figures
// are the board's, counted as the server's activity stats count them (services/activity_service.py
// at the pinned SHA): distinct agents holding an in-progress ticket, and the tickets in Inbox or
// Assigned, mission steps included. A source that has not answered leaves its clause out rather
// than show a 0 it does not know. Tabs: Board = the cards in Review or Blocked (the handoff's),
// Questions = needs-you counts.question (the server's), Calendar and Deliverables from their data.

import type { NeedsYouCounts } from '../../api/needs-you';
import { pluralForm } from '../../ui/variants';
import { boardColumn, topLevelTickets } from '../board/board';
import type { BoardTicket } from '../board/schemas';
import { SHELL_COPY } from '../strings';
import type { TabCounts } from './tabs';

export type BoardFigures = { readonly working: number; readonly queued: number };

const QUEUED: ReadonlySet<string> = new Set(['inbox', 'assigned']);
/** The Board tab's figure: the cards that wait on a person (the handoff's blocked + review). */
const WAITING_ON_YOU: ReadonlySet<string> = new Set(['review', 'blocked']);

export function boardFigures(tickets: readonly BoardTicket[]): BoardFigures {
  const working = new Set(
    tickets.flatMap((ticket) =>
      boardColumn(ticket.status) === 'in_progress' && ticket.agent ? [ticket.agent.id] : [],
    ),
  );
  const queued = tickets.filter((ticket) => QUEUED.has(boardColumn(ticket.status))).length;
  return { working: working.size, queued };
}

/** A run of the lede: a figure is set in mono, the needs clause in the accent. */
export type LedePart = {
  readonly text: string;
  readonly figure: boolean;
  readonly needs: boolean;
};

export type LedeInput = {
  /** The board's figures, or null before the board has answered. */
  readonly figures: BoardFigures | null;
  /** useNeedsYou's total as served, or null before needs-you has answered. */
  readonly needsTotal: number | null;
};

const words = (text: string, needs = false): LedePart => ({ text, figure: false, needs });
const figure = (count: number, needs = false): LedePart => ({
  text: String(count),
  figure: true,
  needs,
});

function needsClause(total: number): LedePart[] {
  if (total === 0) return [words(SHELL_COPY.nothingNeeds)];
  return [figure(total, true), words(` ${pluralForm(total, SHELL_COPY.needs)}`, true)];
}

function isCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}

/** The sentence's first letter in capitals when it opens with words ('Nothing needs your eyes.'). */
function capitalised(parts: readonly LedePart[]): LedePart[] {
  const [first, ...rest] = parts;
  if (!first || first.figure) return [...parts];
  return [{ ...first, text: first.text.charAt(0).toUpperCase() + first.text.slice(1) }, ...rest];
}

/** The lede's runs, or none when no source has answered yet. */
export function ledeParts({ figures, needsTotal }: LedeInput): LedePart[] {
  const clauses: LedePart[][] = [
    ...(figures
      ? [
          [figure(figures.working), words(` ${pluralForm(figures.working, SHELL_COPY.agents)}`)],
          [figure(figures.queued), words(` ${SHELL_COPY.inQueue}`)],
        ]
      : []),
    ...(isCount(needsTotal) ? [needsClause(needsTotal)] : []),
  ];
  if (clauses.length === 0) return [];
  const joined = clauses.flatMap((parts, index) => (index === 0 ? parts : [words(', '), ...parts]));
  return [...capitalised(joined), words('.')];
}

/** The lede as one line of text (what VoiceOver reads; the tests read it too). */
export function ledeText(parts: readonly LedePart[]): string {
  return parts.map((part) => part.text).join('');
}

export type TabCountInput = {
  /** The board's tickets, or null before it has answered. */
  readonly board: readonly BoardTicket[] | null;
  /** needs-you's counts as served, or null before it has answered. */
  readonly needsYou: NeedsYouCounts | null;
  /** Today's items on the calendar (US-011), or null. */
  readonly calendarToday?: number | null;
  /** The Deliverables tab's figure from its own data (US-013), or null. */
  readonly deliverables?: number | null;
};

export function tabCounts(input: TabCountInput): TabCounts {
  const board = input.board
    ? topLevelTickets(input.board).filter((ticket) =>
        WAITING_ON_YOU.has(boardColumn(ticket.status)),
      ).length
    : null;
  return {
    board,
    calendar: input.calendarToday ?? null,
    questions: input.needsYou ? input.needsYou.question : null,
    deliverables: input.deliverables ?? null,
  };
}
