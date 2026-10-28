import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { STUDIO_COLOURS } from '../../styles/tokens/studio';
import { PIP_TOKENS } from '../../ui/variants';
import { BOARD_STATUSES } from '../board/board';
import { AGENT_SWATCHES, NO_AGENT_SWATCH } from '../board/chrome';
import { BoardSchema, type BoardTicket } from '../board/schemas';
import {
  MAX_CARD_TAGS,
  agentSwatch,
  boardView,
  emptyCopy,
  filterInForce,
  filterPills,
  ticketCard,
} from '../board/view-model';
import { CC_ROUTES } from '../routes';
import { BOARD_COPY } from '../strings';

let nextId = 100;

// A row as api/board_tasks.py list_tasks serves it at the pinned SHA, parsed as the Board does.
function ticket(overrides: Record<string, unknown> = {}): BoardTicket {
  nextId += 1;
  const row = {
    id: nextId,
    number: `#0${nextId}`,
    workspace_seq: nextId,
    source_type: 'user',
    title: 'Reconcile October invoices',
    status: 'inbox',
    priority: 'medium',
    tags: [],
    review_reason: null,
    blocked_code: null,
    parent_task_id: null,
    agent: { id: 7, name: 'Ledger' },
    ...overrides,
  };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

describe('ticketCard', () => {
  it('maps a ticket to the handoff card: kind row, title, reason, tags, agent', () => {
    const card = ticketCard(
      ticket({
        id: 422,
        number: '#0422',
        source_type: 'orchestration',
        priority: 'high',
        status: 'blocked',
        blocked_code: 'question',
        title: 'Q4 competitor sweep',
        tags: ['research', 'mission:Autumn'],
        agent: { id: 3, name: 'Scout' },
      }),
    );
    expect(card).toMatchObject({
      id: 422,
      href: routes.cc.ticket(422),
      number: '#0422',
      kind: 'Mission',
      kindWord: 'Mission',
      priority: 'High',
      status: { pip: 'blocked', word: 'Blocked' },
      title: 'Q4 competitor sweep',
      reason: 'Question',
      tags: ['research'],
      agent: { name: 'Scout', swatch: agentSwatch('Scout') },
    });
  });

  it('opens the ticket sheet by its row id, never its number', () => {
    const card = ticketCard(ticket({ id: 2680, number: '#1394' }));
    expect(card.href).toBe('/cc/ticket/2680');
  });

  it('names each kind from what filed it (ticket-kind)', () => {
    const kinds = ['user', 'recipe', 'orchestration', 'heartbeat', 'something-new'].map(
      (source_type) => ticketCard(ticket({ source_type })).kind,
    );
    expect(kinds).toEqual(['Task', 'Playbook', 'Mission', 'Routine', 'Task']);
  });

  it('marks only a raised priority, as the web does', () => {
    const words = ['urgent', 'high', 'medium', 'low', 'whenever'].map(
      (priority) => ticketCard(ticket({ priority })).priority,
    );
    expect(words).toEqual(['Urgent', 'High', null, null, null]);
  });

  it('gives every column its dot and word, Failed and Cancelled too', () => {
    const statuses = BOARD_STATUSES.map((status) => ticketCard(ticket({ status })).status);
    expect(statuses.map((each) => each.pip)).toEqual([...BOARD_STATUSES]);
    expect(statuses.map((each) => each.word)).toEqual([
      'Inbox',
      'Assigned',
      'In Progress',
      'Review',
      'Blocked',
      'Done',
      'Failed',
      'Cancelled',
    ]);
  });

  it('says Closed for a closed ticket, with its chip', () => {
    const card = ticketCard(ticket({ status: 'closed' }));
    expect(card.status).toEqual({ pip: 'closed', word: 'Closed' });
    expect(card.reason).toBe('Closed');
  });

  it('keeps an unknown status under its own word; an old alias takes its column dot', () => {
    expect(ticketCard(ticket({ status: 'waiting_on_host' })).status).toEqual({
      pip: 'waiting_on_host',
      word: 'Waiting on host',
    });
    expect(ticketCard(ticket({ status: 'running' })).status).toEqual({
      pip: 'in_progress',
      word: 'Running',
    });
  });

  it('chips Review and Blocked from the vendored ticket-stage, nothing elsewhere', () => {
    expect(ticketCard(ticket({ status: 'review', review_reason: 'approval_action' })).reason).toBe(
      'Your OK',
    );
    expect(ticketCard(ticket({ status: 'review' })).reason).toBe('Review');
    expect(ticketCard(ticket({ status: 'blocked', blocked_code: 'approval' })).reason).toBe(
      'Approval',
    );
    expect(ticketCard(ticket({ status: 'in_progress' })).reason).toBeNull();
  });

  it('drops the mission bookkeeping tag and shows at most three tags', () => {
    const card = ticketCard(ticket({ tags: ['a', 'mission:X', 'b', 'c', 'd'] }));
    expect(card.tags).toEqual(['a', 'b', 'c']);
    expect(card.tags).toHaveLength(MAX_CARD_TAGS);
  });

  it('says Unassigned with the muted swatch when no agent of the workspace holds it', () => {
    const card = ticketCard(ticket({ agent: null }));
    expect(card.agent).toEqual({ name: BOARD_COPY.unassigned, swatch: NO_AGENT_SWATCH });
  });

  it('reads a ticket with no number or title', () => {
    const card = ticketCard(ticket({ number: null, workspace_seq: null, title: '   ' }));
    expect(card.number).toBeNull();
    expect(card.title).toBe(BOARD_COPY.untitled);
  });

  it('says the whole card in one accessibility label', () => {
    const card = ticketCard(
      ticket({
        number: '#0419',
        status: 'blocked',
        blocked_code: 'question',
        priority: 'urgent',
        title: 'Reconcile invoices',
      }),
    );
    expect(card.accessibilityLabel).toBe(
      '#0419, Task, Urgent, Blocked, Reconcile invoices, Question, Ledger',
    );
  });

  it('has no row status without a server state, and its label is the board one (PRD-268)', () => {
    const card = ticketCard(ticket({ status: 'in_progress', next_step: 'Writing the intro.' }));
    expect(card.rowStatus).toBeNull();
    expect(card.accessibilityLabel).toContain('In Progress');
    const unknown = ticketCard(ticket({ display_state: 'snoozed' }));
    expect(unknown.rowStatus).toBeNull();
  });

  it("takes the server's state, next step and Try again, and says them first", () => {
    const card = ticketCard(
      ticket({
        id: 2680,
        number: '#0419',
        status: 'failed',
        priority: 'urgent',
        title: 'Reconcile invoices',
        display_state: 'failed',
        next_step: 'The bank feed timed out',
        retry: { kind: 'retry_ticket' },
      }),
    );
    expect(card.rowStatus).toEqual({
      state: 'failed',
      next: 'The bank feed timed out',
      retry: {
        kind: 'retry_ticket',
        route: CC_ROUTES.board.runNow,
        params: { task_id: '2680' },
      },
      accessibilityLabel: "Couldn't finish: Reconcile invoices. The bank feed timed out.",
    });
    expect(card.accessibilityLabel).toBe(
      "Couldn't finish: Reconcile invoices. The bank feed timed out. #0419, Task, Urgent, Ledger",
    );
  });

  it("sends a mission card's Try again to its Mission", () => {
    const run = 'a2b4c6d8-0000-4000-8000-000000000003';
    const card = ticketCard(
      ticket({
        source_type: 'orchestration',
        orchestration_run_id: run,
        display_state: 'failed',
        retry: { kind: 'replan_mission' },
      }),
    );
    expect(card.rowStatus?.retry).toEqual({
      kind: 'replan_mission',
      route: CC_ROUTES.missions.replan,
      params: { mission_id: run },
    });
    const orphan = ticketCard(
      ticket({ display_state: 'failed', retry: { kind: 'rerun_mission' } }),
    );
    expect(orphan.rowStatus).toMatchObject({ state: 'failed', retry: null });
  });

  it('does not touch the ticket it maps', () => {
    const source = ticket({ tags: ['a', 'mission:X'] });
    const before = JSON.stringify(source);
    ticketCard(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('agentSwatch', () => {
  it('gives one agent one swatch, however its name is written', () => {
    expect(agentSwatch('Scout')).toBe(agentSwatch(' scout '));
    expect(agentSwatch('Scout Engineer')).toBe(agentSwatch('Scout'));
  });

  it('is always a token from the swatch set, and muted for no name', () => {
    const names = ['Scout', 'Ledger', 'Quill', 'Relay', 'Atlas', 'Auto', 'x', '42'];
    names.forEach((name) => expect(AGENT_SWATCHES).toContain(agentSwatch(name)));
    expect(agentSwatch(null)).toBe(NO_AGENT_SWATCH);
    expect(agentSwatch('  ')).toBe(NO_AGENT_SWATCH);
  });

  it('spreads a roster over more than one swatch', () => {
    const names = ['Scout', 'Ledger', 'Quill', 'Relay', 'Atlas', 'Comms', 'Fixer', 'Pulse'];
    expect(new Set(names.map(agentSwatch)).size).toBeGreaterThan(2);
  });

  it('names swatches that exist in Light and Dark', () => {
    [...AGENT_SWATCHES, NO_AGENT_SWATCH].forEach((swatch) => {
      expect(STUDIO_COLOURS.light[swatch]).toMatch(/^#/);
      expect(STUDIO_COLOURS.dark[swatch]).toMatch(/^#/);
    });
  });
});

describe('filterPills', () => {
  const tickets = [
    ticket({ status: 'blocked' }),
    ticket({ status: 'blocked' }),
    ticket({ status: 'closed' }),
    ticket({ status: 'waiting_on_host' }),
  ];

  it('offers All, every column (even empty) and each unknown status, with counts', () => {
    const pills = filterPills(tickets, 'all');
    expect(pills.map((pill) => pill.filter)).toEqual(['all', ...BOARD_STATUSES, 'waiting_on_host']);
    expect(pills.map((pill) => pill.count)).toEqual([4, 0, 0, 0, 0, 2, 0, 0, 1, 1]);
    expect(pills.find((pill) => pill.filter === 'failed')?.label).toBe('Failed');
    expect(pills.find((pill) => pill.filter === 'cancelled')?.label).toBe('Cancelled');
  });

  it('dots every column with its pip token, an unknown status muted, All none', () => {
    const pills = filterPills(tickets, 'all');
    expect(pills[0].dot).toBeUndefined();
    BOARD_STATUSES.forEach((status) =>
      expect(pills.find((pill) => pill.filter === status)?.dot).toBe(PIP_TOKENS[status]),
    );
    expect(pills.at(-1)?.dot).toBe('mutedForeground');
  });

  it('marks only the active pill selected', () => {
    const pills = filterPills(tickets, 'blocked');
    expect(pills.filter((pill) => pill.selected).map((pill) => pill.filter)).toEqual(['blocked']);
  });
});

describe('emptyCopy', () => {
  it('has words for All, for every column and for an unknown status', () => {
    expect(emptyCopy('all')).toEqual(BOARD_COPY.emptyAll);
    BOARD_STATUSES.forEach((status) => {
      const copy = emptyCopy(status);
      expect(copy.title).toMatch(/^Nothing in /);
      expect(copy.message).toBe(BOARD_COPY.emptyMessages[status]);
    });
    expect(emptyCopy('failed').title).toBe('Nothing in Failed');
    expect(emptyCopy('waiting_on_host')).toEqual({
      title: 'Nothing in Waiting on host',
      message: BOARD_COPY.emptyOther,
    });
  });
});

describe('boardView', () => {
  it('sorts the cards Blocked → Review → In progress → Assigned → Inbox → Done → Failed → Cancelled', () => {
    const order = ['done', 'inbox', 'cancelled', 'review', 'failed', 'assigned', 'blocked'];
    const view = boardView(
      [...order, 'in_progress', 'closed'].map((status) => ticket({ status })),
      'all',
    );
    expect(view.cards.map((card) => card.status.pip)).toEqual([
      'blocked',
      'review',
      'in_progress',
      'assigned',
      'inbox',
      'done',
      'failed',
      'cancelled',
      'closed',
    ]);
    expect(view.empty).toBeNull();
  });

  it('shows one filter: Cancelled holds the closed tickets too', () => {
    const view = boardView(
      [ticket({ status: 'cancelled' }), ticket({ status: 'closed' }), ticket({ status: 'done' })],
      'cancelled',
    );
    expect(view.filter).toBe('cancelled');
    expect(view.cards.map((card) => card.status.word)).toEqual(['Cancelled', 'Closed']);
  });

  it('lists and counts top-level tickets: a mission step nests under its mission', () => {
    const mission = ticket({ status: 'in_progress', source_type: 'orchestration' });
    const step = ticket({ status: 'blocked', parent_task_id: mission.id });
    const view = boardView([mission, step], 'all');
    expect(view.cards.map((card) => card.id)).toEqual([mission.id]);
    expect(view.pills.find((pill) => pill.filter === 'blocked')?.count).toBe(0);
  });

  it('gives an empty filter its own words', () => {
    const view = boardView([ticket({ status: 'inbox' })], 'failed');
    expect(view.cards).toEqual([]);
    expect(view.empty).toEqual(emptyCopy('failed'));
  });

  it('says the board is empty when there are no tickets', () => {
    const view = boardView([], 'all');
    expect(view.pills).toHaveLength(1 + BOARD_STATUSES.length);
    expect(view.empty).toEqual(BOARD_COPY.emptyAll);
  });

  it('falls back to All once the unknown status it was filtering is gone', () => {
    expect(filterInForce([ticket({ status: 'waiting_on_host' })], 'waiting_on_host')).toBe(
      'waiting_on_host',
    );
    const view = boardView([ticket({ status: 'inbox' })], 'waiting_on_host');
    expect(view.filter).toBe('all');
    expect(view.pills[0].selected).toBe(true);
    expect(view.cards).toHaveLength(1);
  });

  it('keeps a column filter even when the column empties', () => {
    expect(filterInForce([], 'review')).toBe('review');
  });
});
