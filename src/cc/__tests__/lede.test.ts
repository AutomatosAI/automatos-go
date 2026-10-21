import { describe, expect, it } from 'vitest';

import { NeedsYouSchema } from '../../api/needs-you';
import { BoardSchema, type BoardTicket } from '../board/schemas';
import {
  boardFigures,
  ledeParts,
  ledeText,
  tabCounts,
  type BoardFigures,
  type LedePart,
} from '../shell/lede';

// A board row as api/board_tasks.py list_tasks serves it at the pinned SHA, trimmed to the fields
// the shell reads; the schema ignores the rest.
function ticket(id: number, status: string, overrides: Record<string, unknown> = {}): BoardTicket {
  const row = {
    id,
    title: `Ticket ${id}`,
    status,
    priority: 'medium',
    tags: [],
    agent: { id: 7, name: 'Writer' },
    parent_task_id: null,
    ...overrides,
  };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

// GET /api/activity/needs-you as services/needs_you.py serves it: the total is the server's.
function needsYou(total: number, counts: Record<string, number> = {}) {
  return NeedsYouSchema.parse({ total, counts, rows: {} });
}

const say = (figures: BoardFigures | null, needsTotal: number | null) =>
  ledeText(ledeParts({ figures, needsTotal }));

describe('the lede (handoff §2 head)', () => {
  it("reads the handoff's sentence", () => {
    expect(say({ working: 1, queued: 5 }, 6)).toBe(
      '1 agent working, 5 in queue, 6 need your eyes.',
    );
  });

  it('pluralises the agents: 0, 1 and many', () => {
    expect(say({ working: 0, queued: 0 }, null)).toBe('0 agents working, 0 in queue.');
    expect(say({ working: 1, queued: 1 }, null)).toBe('1 agent working, 1 in queue.');
    expect(say({ working: 3, queued: 12 }, null)).toBe('3 agents working, 12 in queue.');
  });

  it('pluralises the needs clause: 0, 1 and many', () => {
    expect(say({ working: 2, queued: 0 }, 0)).toBe(
      '2 agents working, 0 in queue, nothing needs your eyes.',
    );
    expect(say({ working: 2, queued: 0 }, 1)).toBe(
      '2 agents working, 0 in queue, 1 needs your eyes.',
    );
    expect(say({ working: 2, queued: 0 }, 9)).toBe(
      '2 agents working, 0 in queue, 9 need your eyes.',
    );
  });

  it("the needs clause is the server's total, never a sum of its counts or rows", () => {
    const served = needsYou(6, { review: 1, question: 2 });
    const parts = ledeParts({ figures: { working: 1, queued: 5 }, needsTotal: served.total });
    const needs = parts.filter((part) => part.needs && part.figure);
    expect(needs).toEqual([{ text: '6', figure: true, needs: true }]);
  });

  it('marks the figures (mono) and the needs clause (accent)', () => {
    const parts = ledeParts({ figures: { working: 1, queued: 5 }, needsTotal: 6 });
    const figures = parts.filter((part) => part.figure).map((part) => part.text);
    expect(figures).toEqual(['1', '5', '6']);
    const accent = parts.filter((part) => part.needs).map((part) => part.text);
    expect(accent).toEqual(['6', ' need your eyes']);
  });

  it('nothing needing you is words, not an accent figure', () => {
    const parts = ledeParts({ figures: null, needsTotal: 0 });
    expect(ledeText(parts)).toBe('Nothing needs your eyes.');
    expect(parts.some((part: LedePart) => part.needs || part.figure)).toBe(false);
  });

  it('missing board data leaves its clauses out rather than show a wrong number', () => {
    expect(say(null, 6)).toBe('6 need your eyes.');
  });

  it('missing needs-you leaves the needs clause out rather than show 0', () => {
    expect(say({ working: 1, queued: 5 }, null)).toBe('1 agent working, 5 in queue.');
  });

  it('says nothing at all before either source has answered', () => {
    expect(ledeParts({ figures: null, needsTotal: null })).toEqual([]);
  });

  it('refuses a total that is not a count', () => {
    expect(say({ working: 1, queued: 0 }, -1)).toBe('1 agent working, 0 in queue.');
    expect(say({ working: 1, queued: 0 }, Number.NaN)).toBe('1 agent working, 0 in queue.');
  });
});

describe('the board figures (as services/activity_service.py counts them)', () => {
  it('counts distinct agents holding in-progress work, and Inbox plus Assigned in queue', () => {
    const tickets = [
      ticket(1, 'in_progress', { agent: { id: 7, name: 'Writer' } }),
      ticket(2, 'in_progress', { agent: { id: 7, name: 'Writer' } }),
      ticket(3, 'in_progress', { agent: { id: 9, name: 'Ledger' } }),
      ticket(4, 'inbox'),
      ticket(5, 'assigned'),
      ticket(6, 'review'),
      ticket(7, 'done'),
    ];
    expect(boardFigures(tickets)).toEqual({ working: 2, queued: 2 });
  });

  it("folds the web's 'running' into in progress and counts mission steps too", () => {
    const tickets = [
      ticket(1, 'running', { agent: { id: 3, name: 'Relay' } }),
      ticket(2, 'assigned', { parent_task_id: 1 }),
    ];
    expect(boardFigures(tickets)).toEqual({ working: 1, queued: 1 });
  });

  it('an in-progress ticket with no agent is not an agent working', () => {
    expect(boardFigures([ticket(1, 'in_progress', { agent: null })])).toEqual({
      working: 0,
      queued: 0,
    });
  });

  it('an empty board is 0 and 0', () => {
    expect(boardFigures([])).toEqual({ working: 0, queued: 0 });
  });
});

describe('the tab figures', () => {
  const board = [
    ticket(1, 'review'),
    ticket(2, 'blocked'),
    ticket(3, 'blocked', { parent_task_id: 2 }),
    ticket(4, 'in_progress'),
    ticket(5, 'failed'),
  ];

  it("Board counts the cards in Review or Blocked; Questions is needs-you's question count", () => {
    const counts = tabCounts({ board, needsYou: needsYou(9, { question: 3, review: 6 }).counts });
    expect(counts).toEqual({ board: 2, calendar: null, questions: 3, deliverables: null });
  });

  it('a mission step nests under its card, so it is not counted twice', () => {
    expect(tabCounts({ board, needsYou: null }).board).toBe(2);
  });

  it('a source that has not answered has no figure', () => {
    expect(tabCounts({ board: null, needsYou: null })).toEqual({
      board: null,
      calendar: null,
      questions: null,
      deliverables: null,
    });
  });

  it('takes the Calendar and Deliverables figures from their own data', () => {
    const counts = tabCounts({ board: [], needsYou: null, calendarToday: 4, deliverables: 12 });
    expect(counts).toEqual({ board: 0, calendar: 4, questions: null, deliverables: 12 });
  });
});
