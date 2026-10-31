// P1 Today (US-023g), pure: the greeting by the hour, needs-you's line and the orb's figure, the
// stat cards from the numbers the app already has (each left out until it has answered), and the
// Needs you window's two rows from A2's needs strip.

import { describe, expect, it } from 'vitest';

import { NeedsYouSchema, type NeedsYou } from '../../../../api/needs-you';
import { BoardSchema, type BoardTicket } from '../../../../cc/board/schemas';
import { needsStrip } from '../../../../chat/home/needs-strip';
import { routes } from '../../../../navigation/routes';
import { CANDY_TODAY_COPY } from '../../strings';
import {
  STAT_CARD,
  UNKNOWN_FIGURE,
  figureOf,
  greetingFor,
  needRows,
  needsLine,
  queueCount,
  requestOf,
  statCards,
  todayCounts,
} from '../today';

const NOW = Date.parse('2026-10-31T10:30:00Z');
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

// A board row as the Board's query parses it, trimmed to what the counts read.
function ticket(id: number, status: string, overrides: Record<string, unknown> = {}): BoardTicket {
  const row = { id, title: `Ticket ${id}`, status, tags: [], parent_task_id: null, ...overrides };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

const BOARD = [
  ticket(1, 'in_progress'),
  ticket(2, 'running'), // the web's old alias, in the same column
  ticket(3, 'in_progress', { parent_task_id: 1 }), // a mission step: nested under its card
  ticket(4, 'inbox'),
  ticket(5, 'assigned'),
  ticket(6, 'assigned', { parent_task_id: 1 }),
  ticket(7, 'review'),
  ticket(8, 'done'),
];

const askRow = (id: string, overrides: object = {}) => ({
  source: 'grant',
  id,
  title: 'Which supplier for the oat milk?',
  ticket_id: 419,
  number: '#0419',
  agent_name: 'Ledger',
  mission_id: null,
  mission_number: null,
  mission_title: null,
  at: minutesAgo(12),
  ...overrides,
});

const ticketRow = (ticketId: number, overrides: object = {}) => ({
  ticket_id: ticketId,
  number: `#${ticketId}`,
  title: `Review ${ticketId}`,
  agent_name: 'Iris',
  mission_id: null,
  mission_number: null,
  mission_title: null,
  opens: 'ticket',
  at: minutesAgo(30),
  why: null,
  ...overrides,
});

function answer(total: number, rows: Partial<Record<keyof NeedsYou['rows'], unknown[]>>) {
  return NeedsYouSchema.parse({
    total,
    rows: { review: [], question: [], approval: [], stuck: [], failed: [], ...rows },
  });
}

describe("Today's header and orb", () => {
  it('greets by the hour, with no name: morning before noon, afternoon until six, then evening', () => {
    expect([0, 9, 11].map(greetingFor)).toEqual(Array(3).fill('Good morning'));
    expect([12, 15, 17].map(greetingFor)).toEqual(Array(3).fill('Good afternoon'));
    expect([18, 23].map(greetingFor)).toEqual(Array(2).fill('Good evening'));
  });

  it("says needs-you's total in words once it has answered, nothing before", () => {
    expect(needsLine(null)).toBeNull();
    expect(needsLine(0)).toBe('Nothing needs you');
    expect(needsLine(1)).toBe('1 thing needs you');
    expect(needsLine(3)).toBe('3 things need you');
    expect(needsLine(Number.NaN)).toBeNull();
  });

  it("shows needs-you's number on the orb, '—' until it is known", () => {
    expect(figureOf(4)).toBe('4');
    expect(figureOf(0)).toBe('0');
    expect(figureOf(null)).toBe(UNKNOWN_FIGURE);
    expect(CANDY_TODAY_COPY.orbCaption).toBe('need you');
  });
});

describe("Today's stat cards (D-CAN-6)", () => {
  it("counts the Board's top-level In progress, and Inbox with Assigned as the queue", () => {
    expect(todayCounts({ needs: 3, board: BOARD })).toEqual({ working: 2, needs: 3, queue: 2 });
    expect(queueCount([])).toBe(0);
  });

  it('draws Working now, Needs you (the tall one) and In queue in the kit’s order and sets', () => {
    const cards = statCards(todayCounts({ needs: 3, board: BOARD }));
    expect(cards.map(({ key, label, figure, set, height }) => [key, label, figure, set, height])).toEqual([
      ['working', 'Working now', '2', 1, STAT_CARD.height],
      ['needs', 'Needs you', '3', 2, STAT_CARD.tallHeight],
      ['queue', 'In queue', '2', 3, STAT_CARD.height],
    ]);
    expect(cards[0]?.accessibilityLabel).toBe('Working now, 2');
  });

  it('leaves out a card whose number the app has not had, never shows it as 0', () => {
    const needsOnly = statCards(todayCounts({ needs: 0, board: null }));
    expect(needsOnly.map(({ key, figure, set }) => [key, figure, set])).toEqual([['needs', '0', 2]]);
    const boardOnly = statCards(todayCounts({ needs: null, board: [] }));
    expect(boardOnly.map(({ key, figure }) => [key, figure])).toEqual([
      ['working', '0'],
      ['queue', '0'],
    ]);
    expect(statCards(todayCounts({ needs: null, board: null }))).toEqual([]);
  });

  it('keeps the design’s measures', () => {
    expect(STAT_CARD).toMatchObject({ width: 132, height: 156, tallHeight: 172, gap: 12, badge: 34, dot: 12 });
  });
});

describe("Today's Needs you window", () => {
  const strip = needsStrip(
    answer(5, {
      question: [askRow('q1')],
      review: [ticketRow(7), ticketRow(8)],
    }),
  );

  it("takes the strip's first two cards, each with its agent, how long ago, and its target", () => {
    const rows = needRows(strip, NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      request: 'Which supplier for the oat milk?',
      meta: 'Ledger · 12 min ago',
      avatarName: 'Ledger',
      set: 1,
      target: { app: routes.cc.questions },
    });
    expect(rows[1]).toMatchObject({
      request: 'Review 7',
      meta: 'Iris · 30 min ago',
      set: 2,
      target: { app: routes.cc.ticket(7) },
    });
  });

  it("is heard as the card's own label", () => {
    const rows = needRows(strip, NOW);
    expect(rows.map((row) => row.accessibilityLabel)).toEqual(
      strip?.cards.slice(0, 2).map((card) => card.accessibilityLabel),
    );
  });

  it('names some agent when the row names none, and leaves the time out when it gives none', () => {
    const anon = needsStrip(answer(1, { review: [ticketRow(9, { agent_name: null, at: null })] }));
    expect(needRows(anon, NOW)[0]).toMatchObject({
      meta: CANDY_TODAY_COPY.someAgent,
      avatarName: '',
    });
  });

  it("leaves a question's agent off its words (it is named under them), and nothing else", () => {
    const card = { kind: 'question', title: 'Ledger: Which one?', agent: 'Ledger' } as const;
    expect(requestOf(card)).toBe('Which one?');
    expect(requestOf({ ...card, kind: 'review' })).toBe('Ledger: Which one?');
    expect(requestOf({ ...card, agent: null })).toBe('Ledger: Which one?');
    expect(requestOf({ ...card, title: 'Ledger: ' })).toBe('Ledger: ');
  });

  it('is empty while nothing needs you', () => {
    expect(needRows(needsStrip(answer(0, {})), NOW)).toEqual([]);
    expect(needRows(null, NOW)).toEqual([]);
  });
});
