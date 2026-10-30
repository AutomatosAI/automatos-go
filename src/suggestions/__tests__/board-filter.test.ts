// The Board's "From suggestions" filter (PRD-268 §6.2.5, US-G01): only where discovery lists
// `suggestions`, the tickets a suggestion's Start filed, whatever their status.

import { describe, expect, it } from 'vitest';

import { FROM_SUGGESTIONS, boardFilters, filterTickets } from '../../cc/board/board';
import { BoardSchema, type BoardTicket } from '../../cc/board/schemas';
import { boardView, emptyCopy } from '../../cc/board/view-model';
import { BOARD_COPY } from '../../cc/strings';

let nextId = 500;

function ticket(overrides: Record<string, unknown> = {}): BoardTicket {
  nextId += 1;
  const [parsed] = BoardSchema.parse({
    tasks: [
      {
        id: nextId,
        number: `#0${nextId}`,
        source_type: 'user',
        title: 'Reconcile October invoices',
        status: 'inbox',
        priority: 'medium',
        tags: [],
        parent_task_id: null,
        agent: { id: 7, name: 'Ledger' },
        ...overrides,
      },
    ],
  }).tasks;
  if (!parsed) throw new Error('fixture did not parse');
  return parsed;
}

const TICKETS = [
  ticket({ source_type: 'suggestion', status: 'in_progress' }),
  ticket({ source_type: 'suggestion', status: 'done' }),
  ticket(),
];

describe('From suggestions', () => {
  it('is offered only where suggestions are, after every status, with its count', () => {
    const offered = boardFilters(TICKETS, { suggestions: true });
    expect(offered[offered.length - 1]).toEqual({
      filter: FROM_SUGGESTIONS,
      word: BOARD_COPY.fromSuggestions,
      count: 2,
    });
    expect(boardFilters(TICKETS).map((option) => option.filter)).not.toContain(FROM_SUGGESTIONS);
  });

  it('keeps the tickets a Start filed, whatever their status', () => {
    expect(filterTickets(TICKETS, FROM_SUGGESTIONS).map((each) => each.status)).toEqual([
      'in_progress',
      'done',
    ]);
  });

  it('draws as a pill without a dot, and says so when empty', () => {
    const view = boardView([ticket()], FROM_SUGGESTIONS, { suggestions: true });
    const pill = view.pills.find((each) => each.filter === FROM_SUGGESTIONS);
    expect(pill).toMatchObject({
      label: 'From suggestions',
      count: 0,
      dot: undefined,
      selected: true,
    });
    expect(view.empty).toEqual(BOARD_COPY.emptySuggestions);
    expect(emptyCopy(FROM_SUGGESTIONS).title).toBe('Nothing from suggestions');
  });

  it('falls back to All on a server without suggestions', () => {
    expect(boardView(TICKETS, FROM_SUGGESTIONS).filter).toBe('all');
  });
});
