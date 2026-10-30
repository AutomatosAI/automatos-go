// The Board's rules, pure (D-BOARD, D26): every status is a filter, Failed and Cancelled too, and
// closed folds into Cancelled as on the web (use-board-tasks.ts, BOARD_COLUMNS). Cards sort as the
// handoff orders the columns (Blocked → Review → In progress → Assigned → Inbox → Done), then Failed
// and Cancelled; within a column the server's order stands (open newest first, finished by finish).
// A status this version does not know is its own filter, under its own word, sorted last: never
// dropped. Words, chips, kinds and numbers come from the vendored web modules, not a second table.
// PRD-268 §6.2.5 (US-G01): where discovery lists `suggestions`, one more filter, From suggestions,
// keeps the tickets a suggestion's Start filed (source_type 'suggestion'), whatever their status.

import { ticketKind, type TicketKind } from '../../core/web/components/activity/board/ticket-kind';
import { stageReason } from '../../core/web/components/activity/board/ticket-stage';
import { ticketNumber } from '../../core/web/lib/ticket-number';
import { PRIORITY_CONFIG, STATUS_CONFIG, type BoardStatus } from '../../core/web/types/board';
import { BOARD_COPY } from '../strings';
import type { BoardTicket } from './schemas';

/** The Board's columns, each one a filter (D26): the web's eight, closed inside cancelled. */
export const BOARD_STATUSES = [
  'inbox',
  'assigned',
  'in_progress',
  'review',
  'blocked',
  'done',
  'failed',
  'cancelled',
] as const;
export type BoardColumn = (typeof BOARD_STATUSES)[number];

/** A column, or a status this version does not know (its own filter). */
export type BoardFilter = 'all' | BoardColumn | (string & Record<never, never>);

/** The From suggestions filter: a value no status has (statuses are words, never 'a:b'). */
export const FROM_SUGGESTIONS = 'source:suggestion';
/** The source_type of a ticket a suggestion's Start filed (§6.2.5). */
export const SUGGESTION_SOURCE = 'suggestion';

export type BoardFilterOptions = {
  /** Offer From suggestions (discovery lists `suggestions`). */
  readonly suggestions?: boolean;
};

/** The handoff's card order, then Failed and Cancelled; an unknown status sorts after them. */
export const SORT_ORDER: readonly BoardColumn[] = [
  'blocked',
  'review',
  'in_progress',
  'assigned',
  'inbox',
  'done',
  'failed',
  'cancelled',
];

/** Statuses that sit in another column: closed (PRD-252 R7) and the web's two old aliases. */
const FOLDS: Readonly<Record<string, BoardColumn>> = Object.freeze({
  closed: 'cancelled',
  running: 'in_progress',
  completed: 'done',
});

const COLUMNS: ReadonlySet<string> = new Set(BOARD_STATUSES);

export function isBoardColumn(value: string): value is BoardColumn {
  return COLUMNS.has(value);
}

/** The column a status sits in, or the status itself when this version does not know it. */
export function boardColumn(status: string): string {
  if (isBoardColumn(status)) return status;
  return FOLDS[status] ?? status;
}

function isKnownStatus(status: string): status is BoardStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_CONFIG, status);
}

/** 'waiting_on_host' → 'Waiting on host': an unknown status still reads as words. */
/** A server word this version has no word for, as a person reads it: 'waiting_on_host' → 'Waiting on host'. */
export function humanised(status: string): string {
  const words = status.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : status;
}

/** The web's word for a status or column (STATUS_CONFIG: 'In Progress', 'Closed'), else its own. */
export function statusWord(status: string): string {
  return isKnownStatus(status) ? STATUS_CONFIG[status].label : humanised(status);
}

function rank(ticket: BoardTicket): number {
  const at = SORT_ORDER.indexOf(boardColumn(ticket.status) as BoardColumn);
  return at === -1 ? SORT_ORDER.length : at;
}

/** A sorted copy; the input is not touched and equal ranks keep their order (a stable sort). */
export function sortTickets(tickets: readonly BoardTicket[]): BoardTicket[] {
  return [...tickets].sort((a, b) => rank(a) - rank(b));
}

/** The tickets in one column (closed in cancelled) or under one unknown status; 'all' is all. */
export function filterTickets(tickets: readonly BoardTicket[], filter: BoardFilter): BoardTicket[] {
  if (filter === 'all') return [...tickets];
  if (filter === FROM_SUGGESTIONS)
    return tickets.filter((ticket) => ticket.source_type === SUGGESTION_SOURCE);
  return tickets.filter((ticket) => boardColumn(ticket.status) === filter);
}

export type BoardFilterOption = {
  readonly filter: BoardFilter;
  readonly word: string;
  readonly count: number;
};

function countBy(tickets: readonly BoardTicket[]): ReadonlyMap<string, number> {
  return tickets.reduce((counts, ticket) => {
    const column = boardColumn(ticket.status);
    return new Map(counts).set(column, (counts.get(column) ?? 0) + 1);
  }, new Map<string, number>());
}

/** From suggestions, where it is offered: the tickets a suggestion's Start filed. */
function suggestionFilter(tickets: readonly BoardTicket[]): BoardFilterOption {
  const count = filterTickets(tickets, FROM_SUGGESTIONS).length;
  return { filter: FROM_SUGGESTIONS, word: BOARD_COPY.fromSuggestions, count };
}

/**
 * All, every column (even when empty), then each unknown status the tickets carry, with counts;
 * then From suggestions where it is offered.
 */
export function boardFilters(
  tickets: readonly BoardTicket[],
  { suggestions = false }: BoardFilterOptions = {},
): BoardFilterOption[] {
  const counts = countBy(tickets);
  const unknown = [...counts.keys()].filter((column) => !isBoardColumn(column));
  const extra = suggestions ? [suggestionFilter(tickets)] : [];
  return [
    { filter: 'all', word: BOARD_COPY.all, count: tickets.length },
    ...[...BOARD_STATUSES, ...unknown].map((column) => ({
      filter: column,
      word: statusWord(column),
      count: counts.get(column) ?? 0,
    })),
    ...extra,
  ];
}

/** The web's board: a mission step nests under its parent card, so only top-level cards list. */
export function topLevelTickets(tickets: readonly BoardTicket[]): BoardTicket[] {
  return tickets.filter((ticket) => ticket.parent_task_id === null);
}

type StageFields = Pick<BoardTicket, 'status' | 'review_reason' | 'blocked_code'>;

/** ticket-stage.ts types the status as the web's union; it only compares it, so any string reads. */
function stageOf(ticket: StageFields) {
  return stageReason({ ...ticket, status: ticket.status as BoardStatus });
}

/** The reason chip of a ticket in Review or Blocked, or a closed one ('Closed'); null otherwise. */
export function reasonChip(ticket: StageFields): string | null {
  return stageOf(ticket)?.chip ?? null;
}

/** The sentence behind the chip, for the ticket sheet. */
export function reasonSays(ticket: StageFields): string | null {
  return stageOf(ticket)?.says ?? null;
}

/** The handoff's kind icons (lucide names): the card maps a name to its component. */
export const KIND_ICONS: Readonly<Record<TicketKind, string>> = Object.freeze({
  Task: 'check-square',
  Playbook: 'book-marked',
  Mission: 'target',
  Routine: 'refresh-cw',
});

export type TicketKindView = {
  readonly kind: TicketKind;
  readonly icon: string;
};

/** What filed the ticket, as a person reads it (ticket-kind.ts), with its icon. */
export function kindOf(ticket: Pick<BoardTicket, 'source_type'>): TicketKindView {
  const kind = ticketKind(ticket.source_type);
  return { kind, icon: KIND_ICONS[kind] };
}

/** The web's word for a priority ('High'); one it does not know reads as itself. */
export function priorityWord(priority: string): string {
  return Object.prototype.hasOwnProperty.call(PRIORITY_CONFIG, priority)
    ? PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG].label
    : humanised(priority);
}

/** Its board number, #0042 (the API's, else its workspace_seq), or null: never the row id (F414). */
export function ticketNumberOf(ticket: BoardTicket): string | null {
  return ticketNumber(ticket);
}

/** The title as sent, or a word for none. */
export function ticketTitle(ticket: Pick<BoardTicket, 'title'>): string {
  return ticket.title.trim() || BOARD_COPY.untitled;
}

const MISSION_TAG = 'mission:';

/** Tags a card shows: the web drops its 'mission:<name>' bookkeeping tag. */
export function visibleTags(ticket: Pick<BoardTicket, 'tags'>): string[] {
  return ticket.tags.filter((tag) => !tag.startsWith(MISSION_TAG));
}

/** The mission a ticket belongs to, from its 'mission:<name>' tag, or null. */
export function missionName(ticket: Pick<BoardTicket, 'tags'>): string | null {
  const tag = ticket.tags.find((each) => each.startsWith(MISSION_TAG));
  return tag ? tag.slice(MISSION_TAG.length) || null : null;
}
