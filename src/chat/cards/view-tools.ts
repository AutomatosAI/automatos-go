// The grant cards and the ticket card as the thread draws them (pure). A tool approval shows what
// the owner approves (question_md, else the message), the call's name, its permission level, the
// oversight note and the params digest as key and value lines (never raw JSON), and its state: it
// waits for you while open, as its tool line and receipt say, never failed. A withdraw offer is one
// card for its requests, each settled on its own. A ticket the reply filed or checked reads as the
// handoff's '#0431: filed to Inbox' and opens on the board through the foundation's cc.ticket.

import { BOARD_COLUMNS } from '../../core/web/types/board';
import { clip } from '../../core/web/components/play/chat/labels';
import { UNNAMED_ACTION } from '../../core/web/lib/chat/approvals';
import { ticketNumber } from '../../core/web/lib/ticket-number';
import type { TaskCardData } from '../../core/web/types';
import { isTaskId, routes } from '../../navigation/routes';
import type { WebLinkTarget } from '../../navigation/web-links';
import { joinLabel } from '../../ui/paint';
import { countPhrase } from '../../ui/variants';
import { GRANT_COPY, TICKET_COPY } from '../strings';
import { toolLine, withdrawSettled, type GrantLine } from './grants';
import type { CardOutcome, FiledCard, ThreadCard } from './model';
import { oversightView, type OversightView } from './oversight';

/** One line per value, as the web's truncated digest shows it. */
const PARAM_CHARS = 200;
/** The board's columns, by status (a closed ticket has no column of its own: its words). */
const STATUS_LABELS: ReadonlyMap<string, string> = new Map(
  BOARD_COLUMNS.map((column) => [column.status, column.label]),
);
const INBOX = 'inbox';

export type ParamRow = { readonly key: string; readonly value: string };

export type ToolApprovalRow = {
  readonly kind: 'tool';
  readonly key: string;
  readonly grantId: number;
  /** The call's name as sent; platform_action for one that has none (approvals.ts). */
  readonly action: string;
  /** What the owner approves; null when the card says neither a question nor a message. */
  readonly question: string | null;
  readonly permission: string | null;
  readonly oversight: OversightView | null;
  readonly params: readonly ParamRow[];
  readonly outcome: CardOutcome;
  readonly line: GrantLine;
  /** The buttons are gone: the click went through (Approve & run, Deny, or a Withdraw). */
  readonly decided: boolean;
};

export type WithdrawRequestRow = {
  readonly key: string;
  readonly grantId: number;
  /** The request's reason, else its action, else 'Request #N' (the web's order). */
  readonly label: string;
  readonly outcome: CardOutcome;
  /** 'Withdrawn.' or 'Kept — it still waits for your yes.'; null while open. */
  readonly settled: string | null;
};

export type WithdrawRow = {
  readonly kind: 'withdraw';
  readonly key: string;
  /** The offer's own words ('You said no while this still waits on a yes…'). */
  readonly message: string;
  readonly requests: readonly WithdrawRequestRow[];
};

export type TicketRow = {
  readonly key: string;
  /** '#0431: filed to Inbox', '#0425: In Progress'. */
  readonly headline: string;
  readonly title: string;
  /** Who has it, its last tool, the files it touched, how it ended; null when none is known. */
  readonly facts: string | null;
  /** The ticket on the board; null for an id that is not a board row id. */
  readonly link: WebLinkTarget | null;
  readonly accessibilityLabel: string;
};

type Tool = Extract<ThreadCard, { kind: 'tool' }>['tool'];
type Withdraw = Extract<ThreadCard, { kind: 'withdraw' }>;

const words = (text: string | null | undefined) => text?.trim() || null;

function paramText(value: unknown): string {
  if (typeof value === 'string') return clip(value, PARAM_CHARS);
  if (value === null || typeof value !== 'object') return String(value);
  return clip(JSON.stringify(value) ?? '', PARAM_CHARS);
}

export function paramRows(params: Readonly<Record<string, unknown>> | undefined): ParamRow[] {
  return Object.entries(params ?? {}).map(([key, value]) => ({ key, value: paramText(value) }));
}

export function toolRow(card: FiledCard, tool: Tool): ToolApprovalRow {
  return {
    kind: 'tool',
    key: card.key,
    grantId: tool.grant_id,
    action: words(tool.action) ?? UNNAMED_ACTION,
    question: words(tool.question_md) ?? words(tool.message),
    permission: words(tool.permission_level),
    oversight: oversightView(tool),
    params: paramRows(tool.params),
    outcome: card.outcome,
    line: toolLine(card.outcome),
    decided: card.outcome.state !== 'open',
  };
}

function requestRow(card: FiledCard, withdraw: Withdraw): WithdrawRequestRow {
  const { request } = withdraw;
  return {
    key: card.key,
    grantId: request.grant_id,
    label: words(request.reason) ?? words(request.action) ?? GRANT_COPY.request(request.grant_id),
    outcome: card.outcome,
    settled: withdrawSettled(card.outcome),
  };
}

/** An offer's requests as one card, keyed by the turn that offered them. */
export function withdrawRow(cards: readonly FiledCard[]): WithdrawRow | null {
  const requests = cards.flatMap((card) =>
    card.card.kind === 'withdraw' ? [{ card, withdraw: card.card }] : [],
  );
  const first = requests[0];
  if (!first) return null;
  return {
    kind: 'withdraw',
    key: `withdraw-${first.card.since}`,
    message: first.withdraw.message,
    requests: requests.map(({ card, withdraw }) => requestRow(card, withdraw)),
  };
}

function statusPhrase(status: string): string {
  if (status === INBOX) return TICKET_COPY.filedToInbox;
  return STATUS_LABELS.get(status) ?? status.replace(/_/g, ' ');
}

function ticketFacts(card: TaskCardData): string | null {
  const agent = words(card.assigned_agent);
  const tool = words(card.last_tool);
  const exit = words(card.exit_reason);
  const facts = [
    agent && agent !== TICKET_COPY.unassigned ? agent : null,
    tool ? TICKET_COPY.lastTool(tool) : null,
    card.files_touched ? countPhrase(card.files_touched, TICKET_COPY.filesTouched) : null,
    exit && exit !== card.status ? TICKET_COPY.exit(exit) : null,
  ].filter((fact): fact is string => fact !== null);
  return facts.length > 0 ? facts.join(' · ') : null;
}

export function ticketRow(card: TaskCardData): TicketRow {
  const headline = `${ticketNumber(card) ?? TICKET_COPY.unnumbered}: ${statusPhrase(card.status)}`;
  const facts = ticketFacts(card);
  const id = String(card.id);
  return {
    key: `ticket-${id}`,
    headline,
    title: card.title,
    facts,
    link: isTaskId(id) ? { app: routes.cc.ticket(id) } : null,
    accessibilityLabel: joinLabel(headline, card.title, facts),
  };
}

/** The tickets a reply carries, one card each (a ticket named twice is drawn once, first place). */
export function ticketRows(cards: readonly TaskCardData[]): TicketRow[] {
  return cards
    .filter((card, index) => cards.findIndex((other) => other.id === card.id) === index)
    .map(ticketRow);
}
