// The Board tab's view, pure (handoff §2 'Board', D-BOARD): the filter pills (All, every column
// with its dot, then any status this version does not know), the sorted cards of the chosen filter
// and the empty copy for it. A card is what TicketCard draws: the kind row (#number, kind, a
// raised priority, the status as dot and word), the title, the reason chip, the tags and the agent.
// Like the web's board (use-board-tasks.ts), the list and its counts are the top-level tickets: a
// mission step nests under its mission's card. The words are board.ts's (the vendored web modules).
// PRD-268 (US-G05): a ticket the server gives a display_state says it with the vocabulary's glyph
// and word where the board's dot and word were, its next step under the title, and Try again when
// it offers one (cc/status/row-status.ts); VoiceOver hears '<word>: <title>. <next step>.' first.
// A ticket without one is the card it always was.

import type { TicketKind } from '../../core/web/components/activity/board/ticket-kind';
import { routes } from '../../navigation/routes';
import type { ColourName } from '../../styles/tokens';
import { joinLabel } from '../../ui/paint';
import { isPipStatus, statusPip } from '../../ui/variants';
import { rowStatusView, type RowStatusView } from '../status/row-status';
import { BOARD_COPY } from '../strings';
import {
  boardColumn,
  boardFilters,
  filterTickets,
  isBoardColumn,
  kindOf,
  priorityWord,
  reasonChip,
  sortTickets,
  statusWord,
  ticketNumberOf,
  ticketTitle,
  topLevelTickets,
  visibleTags,
  type BoardFilter,
} from './board';
import { AGENT_SWATCHES, NO_AGENT_SWATCH } from './chrome';
import type { BoardTicket } from './schemas';

/** The web's card shows up to three tags (board-tab.tsx, the full density). */
export const MAX_CARD_TAGS = 3;

/** The web marks a priority on the card only when it is raised (board-tab.tsx KanbanKindRow). */
const RAISED_PRIORITIES: ReadonlySet<string> = new Set(['urgent', 'high']);

export type TicketCardView = {
  readonly id: number;
  /** routes.cc.ticket(row id): the ticket sheet. */
  readonly href: string;
  readonly number: string | null;
  readonly kind: TicketKind;
  /** The kind as a person reads it ('Mission'); the label face sets it in capitals. */
  readonly kindWord: string;
  /** 'High' or 'Urgent'; null for medium, low or none. */
  readonly priority: string | null;
  /** The dot's status (a pip status, or the unknown status itself) and its word. */
  readonly status: { readonly pip: string; readonly word: string };
  readonly title: string;
  readonly reason: string | null;
  readonly tags: readonly string[];
  readonly agent: { readonly name: string; readonly swatch: ColourName };
  /** The server's state, next step and Try again (PRD-268); null when it sent no state. */
  readonly rowStatus: RowStatusView | null;
  /** The whole card in one sentence: VoiceOver reads a pressable card as one button. */
  readonly accessibilityLabel: string;
};

/** The web's agent key: 'Scout Engineer' → 'scout' (agent-tones.ts normalize). */
function agentKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+engineer$/, '')
    .replace(/[^a-z0-9]/g, '');
}

const HASH_STEP = 31;

/** One agent, one swatch: the name folds onto the token set; no name is the muted swatch. */
export function agentSwatch(name: string | null | undefined): ColourName {
  const key = agentKey(name ?? '');
  if (!key) return NO_AGENT_SWATCH;
  const hash = [...key].reduce(
    (sum, char) => (Math.imul(sum, HASH_STEP) + char.charCodeAt(0)) >>> 0,
    0,
  );
  return AGENT_SWATCHES[hash % AGENT_SWATCHES.length];
}

/** The dot's status: its own when the pip knows it, else its column's (an old alias), else itself. */
function pipOf(status: string): string {
  return isPipStatus(status) ? status : boardColumn(status);
}

function raisedPriority(priority: string): string | null {
  return RAISED_PRIORITIES.has(priority) ? priorityWord(priority) : null;
}

type LabelParts = {
  /** #number, kind, a raised priority. */
  readonly lead: readonly (string | null)[];
  readonly word: string;
  readonly title: string;
  /** The reason chip, the agent. */
  readonly tail: readonly (string | null)[];
};

/** The card in one sentence; with a server state, its own sentence (it names the title) first. */
function cardLabel(rowStatus: RowStatusView | null, { lead, word, title, tail }: LabelParts) {
  if (!rowStatus) return joinLabel(...lead, word, title, ...tail);
  return `${rowStatus.accessibilityLabel} ${joinLabel(...lead, ...tail)}`;
}

export function ticketCard(ticket: BoardTicket): TicketCardView {
  const { kind } = kindOf(ticket);
  const number = ticketNumberOf(ticket);
  const priority = raisedPriority(ticket.priority);
  const word = statusWord(ticket.status);
  const title = ticketTitle(ticket);
  const reason = reasonChip(ticket);
  const agentName = ticket.agent?.name.trim() || BOARD_COPY.unassigned;
  const rowStatus = rowStatusView(ticket, title, {
    ticketId: ticket.id,
    missionId: ticket.orchestration_run_id,
  });
  return {
    id: ticket.id,
    href: routes.cc.ticket(ticket.id),
    number,
    kind,
    kindWord: kind,
    priority,
    status: { pip: pipOf(ticket.status), word },
    title,
    reason,
    tags: visibleTags(ticket).slice(0, MAX_CARD_TAGS),
    agent: { name: agentName, swatch: agentSwatch(ticket.agent?.name) },
    rowStatus,
    accessibilityLabel: cardLabel(rowStatus, {
      lead: [number, kind, priority],
      word,
      title,
      tail: [reason, agentName],
    }),
  };
}

export type FilterPillView = {
  readonly filter: BoardFilter;
  readonly label: string;
  readonly count: number;
  /** The column's dot (the pip's token); none on All. */
  readonly dot: ColourName | undefined;
  readonly selected: boolean;
};

/** All, every column (Failed and Cancelled too, even when empty), then each unknown status. */
export function filterPills(
  tickets: readonly BoardTicket[],
  active: BoardFilter,
): FilterPillView[] {
  return boardFilters(tickets).map((option) => ({
    filter: option.filter,
    label: option.word,
    count: option.count,
    dot: option.filter === 'all' ? undefined : statusPip(option.filter).tokenKey,
    selected: option.filter === active,
  }));
}

export type EmptyCopy = { readonly title: string; readonly message: string };

/** What an empty filter says: All has its own words, a column its own line. */
export function emptyCopy(filter: BoardFilter): EmptyCopy {
  if (filter === 'all') return BOARD_COPY.emptyAll;
  const message = isBoardColumn(filter) ? BOARD_COPY.emptyMessages[filter] : BOARD_COPY.emptyOther;
  return { title: BOARD_COPY.emptyTitle(statusWord(filter)), message };
}

export type BoardView = {
  /** The filter in force: the chosen one, or All once an unknown status it named is gone. */
  readonly filter: BoardFilter;
  readonly pills: readonly FilterPillView[];
  readonly cards: readonly TicketCardView[];
  /** The empty copy when the filter has no card, else null. */
  readonly empty: EmptyCopy | null;
};

/** The chosen filter while the pills still offer it; All otherwise. */
export function filterInForce(tickets: readonly BoardTicket[], chosen: BoardFilter): BoardFilter {
  return boardFilters(tickets).some((option) => option.filter === chosen) ? chosen : 'all';
}

export function boardView(tickets: readonly BoardTicket[], chosen: BoardFilter): BoardView {
  const listed = topLevelTickets(tickets);
  const filter = filterInForce(listed, chosen);
  const cards = sortTickets(filterTickets(listed, filter)).map(ticketCard);
  return {
    filter,
    pills: filterPills(listed, filter),
    cards,
    empty: cards.length === 0 ? emptyCopy(filter) : null,
  };
}
