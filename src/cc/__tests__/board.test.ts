import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import {
  approveTicket,
  boardQuery,
  BOARD_FINISHED_LIMIT,
  fetchBoard,
  fetchTicket,
  sendBack,
  ticketQuery,
} from '../board/api';
import {
  BOARD_STATUSES,
  boardColumn,
  boardFilters,
  filterTickets,
  kindOf,
  missionName,
  priorityWord,
  reasonChip,
  reasonSays,
  sortTickets,
  statusWord,
  ticketNumberOf,
  ticketTitle,
  topLevelTickets,
  visibleTags,
} from '../board/board';
import { BoardSchema, TicketDetailSchema, type BoardTicket } from '../board/schemas';
import {
  approveBody,
  isVerdictInputError,
  SEND_BACK_MAX_CHARS,
  sendBackBody,
} from '../board/verdict';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

// A row as api/board_tasks.py list_tasks serves it at the pinned SHA (board_dict + agent).
function wire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 2680,
    workspace_id: WS,
    workspace_seq: 1394,
    title: 'Draft the launch post',
    description: 'Long brief',
    raw_prompt: 'prompt',
    status: 'inbox',
    priority: 'high',
    review_mode: 'human',
    assigned_agent_id: 7,
    source_type: 'user',
    tags: ['launch', 'mission:Autumn'],
    result: null,
    planning_data: { approval_action: { type: 'publish_blog' } },
    attempts: 0,
    runtime_ref: null,
    created_at: '2026-10-20T08:00:00+00:00',
    updated_at: '2026-10-20T09:00:00+00:00',
    number: '#1394',
    review_reason: null,
    blocked_code: null,
    times_sent_back: 0,
    kept_draft: null,
    knowledge_document_id: null,
    agent: { id: 7, name: 'Writer', agent_icon: null },
    ...overrides,
  };
}

function ticket(overrides: Record<string, unknown> = {}): BoardTicket {
  return BoardSchema.parse({ tasks: [wire(overrides)] }).tasks[0];
}

function clientAnswering(status: number, body: unknown) {
  const transport = fakeTransport(() => jsonReply(status, body));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

describe('board schemas', () => {
  it('keeps what a card reads and ignores the rest', () => {
    const parsed = ticket();
    expect(parsed).toEqual({
      id: 2680,
      number: '#1394',
      workspace_seq: 1394,
      source_type: 'user',
      title: 'Draft the launch post',
      status: 'inbox',
      priority: 'high',
      agent: { id: 7, name: 'Writer' },
      tags: ['launch', 'mission:Autumn'],
      review_reason: null,
      blocked_code: null,
      parent_task_id: null,
      created_at: '2026-10-20T08:00:00+00:00',
      updated_at: '2026-10-20T09:00:00+00:00',
    });
    expect(parsed).not.toHaveProperty('raw_prompt');
    expect(parsed).not.toHaveProperty('planning_data');
  });

  it('keeps a status outside the known set as sent', () => {
    expect(ticket({ status: 'waiting_on_host' }).status).toBe('waiting_on_host');
  });

  it('reads an older server: no number, no agent, odd tags', () => {
    const parsed = ticket({ number: undefined, agent: undefined, tags: ['ok', 3, null] });
    expect(parsed.number).toBeNull();
    expect(parsed.agent).toBeNull();
    expect(parsed.tags).toEqual(['ok']);
  });

  it('leaves out a row it cannot read, never the whole board', () => {
    const parsed = BoardSchema.parse({ tasks: [wire(), { title: 'no id' }, wire({ id: 9 })] });
    expect(parsed.tasks.map((each) => each.id)).toEqual([2680, 9]);
  });

  it('refuses a body with no ticket list', () => {
    expect(BoardSchema.safeParse({ total: 3 }).success).toBe(false);
  });

  it('parses the detail without its cost (D8)', () => {
    const detail = TicketDetailSchema.parse({
      ...wire({ description: 'The brief', result: 'Done it' }),
      cost: { available: true, usd: 0.12, label: '$0.12' },
    });
    expect(detail.description).toBe('The brief');
    expect(detail.result).toBe('Done it');
    expect(detail.times_sent_back).toBe(0);
    expect(detail).not.toHaveProperty('cost');
  });
});

describe('board statuses', () => {
  it('has every column as a filter, Failed and Cancelled too (D26)', () => {
    expect(BOARD_STATUSES).toEqual([
      'inbox',
      'assigned',
      'in_progress',
      'review',
      'blocked',
      'done',
      'failed',
      'cancelled',
    ]);
  });

  it('folds closed into cancelled, and the web aliases into their columns', () => {
    expect(boardColumn('closed')).toBe('cancelled');
    expect(boardColumn('running')).toBe('in_progress');
    expect(boardColumn('completed')).toBe('done');
    for (const status of BOARD_STATUSES) expect(boardColumn(status)).toBe(status);
  });

  it("reads every status in the web's words, and an unknown one in its own", () => {
    expect(BOARD_STATUSES.map(statusWord)).toEqual([
      'Inbox',
      'Assigned',
      'In Progress',
      'Review',
      'Blocked',
      'Done',
      'Failed',
      'Cancelled',
    ]);
    expect(statusWord('closed')).toBe('Closed');
    expect(statusWord('waiting_on_host')).toBe('Waiting on host');
  });
});

describe('sort and filter', () => {
  const tickets = [
    ticket({ id: 1, status: 'done' }),
    ticket({ id: 2, status: 'inbox' }),
    ticket({ id: 3, status: 'cancelled' }),
    ticket({ id: 4, status: 'review' }),
    ticket({ id: 5, status: 'waiting_on_host' }),
    ticket({ id: 6, status: 'failed' }),
    ticket({ id: 7, status: 'in_progress' }),
    ticket({ id: 8, status: 'blocked' }),
    ticket({ id: 9, status: 'closed' }),
    ticket({ id: 10, status: 'assigned' }),
    ticket({ id: 11, status: 'blocked' }),
  ];

  it('sorts Blocked → Review → In progress → Assigned → Inbox → Done → Failed → Cancelled', () => {
    expect(sortTickets(tickets).map((each) => each.id)).toEqual([
      8, 11, 4, 7, 10, 2, 1, 6, 3, 9, 5,
    ]);
  });

  it('keeps the server order within a column and leaves the input as it was', () => {
    const before = tickets.map((each) => each.id);
    sortTickets(tickets);
    expect(tickets.map((each) => each.id)).toEqual(before);
  });

  it('filters one column, closed inside cancelled, and all', () => {
    expect(filterTickets(tickets, 'cancelled').map((each) => each.id)).toEqual([3, 9]);
    expect(filterTickets(tickets, 'failed').map((each) => each.id)).toEqual([6]);
    expect(filterTickets(tickets, 'blocked').map((each) => each.id)).toEqual([8, 11]);
    expect(filterTickets(tickets, 'all')).toHaveLength(tickets.length);
  });

  it('keeps an unknown status: in All, and under its own filter', () => {
    expect(filterTickets(tickets, 'waiting_on_host').map((each) => each.id)).toEqual([5]);
    const options = boardFilters(tickets);
    expect(options.map((each) => each.filter)).toEqual([
      'all',
      ...BOARD_STATUSES,
      'waiting_on_host',
    ]);
    expect(options.find((each) => each.filter === 'waiting_on_host')).toEqual({
      filter: 'waiting_on_host',
      word: 'Waiting on host',
      count: 1,
    });
  });

  it('counts each filter, closed with cancelled, empty columns at 0', () => {
    const counts = Object.fromEntries(
      boardFilters([ticket({ status: 'closed' }), ticket({ status: 'cancelled' })]).map((each) => [
        each.filter,
        each.count,
      ]),
    );
    expect(counts).toMatchObject({ all: 2, cancelled: 2, inbox: 0, failed: 0 });
  });

  it("lists top-level cards only, as the web's board does", () => {
    const step = ticket({ id: 12, parent_task_id: 1 });
    expect(topLevelTickets([tickets[0], step]).map((each) => each.id)).toEqual([1]);
  });
});

describe('card words', () => {
  it('words a reason chip from the vendored ticket-stage', () => {
    expect(reasonChip(ticket({ status: 'blocked', blocked_code: 'question' }))).toBe('Question');
    expect(reasonChip(ticket({ status: 'review', review_reason: 'asked' }))).toBe('You asked');
    expect(reasonChip(ticket({ status: 'review', review_reason: 'new_code' }))).toBe('Review');
    expect(reasonChip(ticket({ status: 'closed' }))).toBe('Closed');
    expect(reasonChip(ticket({ status: 'in_progress' }))).toBeNull();
    expect(reasonChip(ticket({ status: 'waiting_on_host' }))).toBeNull();
    expect(reasonSays(ticket({ status: 'blocked', blocked_code: 'question' }))).toBe(
      'Waiting for your answer to its question.',
    );
  });

  it('names the kind and its icon from the vendored ticket-kind', () => {
    expect(kindOf({ source_type: 'recipe' })).toEqual({ kind: 'Playbook', icon: 'book-marked' });
    expect(kindOf({ source_type: 'orchestration_task' })).toEqual({
      kind: 'Mission',
      icon: 'target',
    });
    expect(kindOf({ source_type: 'heartbeat' })).toEqual({ kind: 'Routine', icon: 'refresh-cw' });
    expect(kindOf({ source_type: 'user' })).toEqual({ kind: 'Task', icon: 'check-square' });
    expect(kindOf({ source_type: null })).toEqual({ kind: 'Task', icon: 'check-square' });
  });

  it('numbers a ticket from the vendored ticket-number, never by its row id', () => {
    expect(ticketNumberOf(ticket())).toBe('#1394');
    expect(ticketNumberOf(ticket({ number: null, workspace_seq: 42 }))).toBe('#0042');
    expect(
      ticketNumberOf(ticket({ number: null, workspace_seq: 42, source_type: 'orchestration_task' })),
    ).toBeNull();
    expect(ticketNumberOf(ticket({ number: null, workspace_seq: null }))).toBeNull();
  });

  it('words priorities, titles, tags and the mission', () => {
    expect(priorityWord('urgent')).toBe('Urgent');
    expect(priorityWord('someday')).toBe('Someday');
    expect(ticketTitle({ title: '  ' })).toBe('Untitled');
    expect(visibleTags(ticket())).toEqual(['launch']);
    expect(missionName(ticket())).toBe('Autumn');
    expect(missionName(ticket({ tags: [] }))).toBeNull();
  });
});

describe('verdict bodies', () => {
  it('approves with a note, or with none', () => {
    expect(approveBody('  Looks right  ')).toEqual({ note: 'Looks right' });
    expect(approveBody('   ')).toEqual({});
    expect(approveBody(undefined)).toEqual({});
  });

  it('refuses a send back with no words', () => {
    for (const blank of ['', '   ', null, undefined]) {
      expect(sendBackBody(blank)).toMatchObject({ ok: false, reason: 'empty' });
    }
  });

  it('refuses a note longer than the server keeps, and trims one it takes', () => {
    expect(sendBackBody('x'.repeat(SEND_BACK_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      reason: 'too_long',
    });
    expect(sendBackBody('  Use the Q3 figures ')).toEqual({
      ok: true,
      body: { feedback: 'Use the Q3 figures' },
    });
  });
});

describe('board calls', () => {
  it("fetches the web's view: every open ticket and the newest 200 finished", async () => {
    const { client, transport } = clientAnswering(200, { tasks: [wire()], total: 1 });
    const board = await fetchBoard(client);
    expect(board.tasks).toHaveLength(1);
    expect(transport.calls[0].method).toBe('GET');
    expect(transport.calls[0].url).toBe(
      `${SERVER.apiUrl}/api/v1/tasks?finished_limit=${BOARD_FINISHED_LIMIT}`,
    );
    expect(transport.calls[0].headers).toMatchObject({ 'X-Workspace-ID': WS });
  });

  it('fetches one ticket by its row id, and refuses a number as an id', async () => {
    const { client, transport } = clientAnswering(200, wire());
    expect((await fetchTicket(client, '2680')).id).toBe(2680);
    expect(transport.calls[0].url).toBe(`${SERVER.apiUrl}/api/v1/tasks/2680`);
    expect(() => fetchTicket(client, '#1394')).toThrow(TypeError);
  });

  it('approves with the note in the body', async () => {
    const { client, transport } = clientAnswering(200, {
      success: true,
      task_id: 2680,
      status: 'done',
      action_result: null,
    });
    const result = await approveTicket(client, 2680, 'Ship it');
    expect(result.status).toBe('done');
    expect(transport.calls[0]).toMatchObject({
      method: 'POST',
      url: `${SERVER.apiUrl}/api/v1/tasks/2680/approve`,
      body: JSON.stringify({ note: 'Ship it' }),
    });
  });

  it('sends back with the feedback in the body', async () => {
    const { client, transport } = clientAnswering(200, {
      success: true,
      task_id: 2680,
      status: 'assigned',
      assigned_agent_id: 7,
      feedback: 'Use the Q3 figures',
    });
    const result = await sendBack(client, 2680, ' Use the Q3 figures ');
    expect(result).toEqual({ status: 'assigned', feedback: 'Use the Q3 figures' });
    expect(transport.calls[0]).toMatchObject({
      method: 'POST',
      url: `${SERVER.apiUrl}/api/v1/tasks/2680/reject`,
      body: JSON.stringify({ feedback: 'Use the Q3 figures' }),
    });
  });

  it('refuses a send back without feedback client-side: nothing is sent', async () => {
    const { client, transport } = clientAnswering(200, {});
    const refused = await sendBack(client, 2680, '   ').catch((error: unknown) => error);
    expect(isVerdictInputError(refused)).toBe(true);
    expect(refused).toMatchObject({ reason: 'empty', message: expect.any(String) });
    expect(transport.calls).toHaveLength(0);
  });

  it("passes the server's refusal through as the taxonomy's error", async () => {
    const { client } = clientAnswering(409, { detail: 'Ticket #1394 was already decided.' });
    const refused = await approveTicket(client, 2680).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).toMatchObject({
      kind: 'conflict',
      serverMessage: 'Ticket #1394 was already decided.',
    });
  });

  it('keys the queries with the shared board and ticket families', () => {
    const { client } = clientAnswering(200, {});
    expect(boardQuery(client).queryKey).toEqual(queryKeys.board());
    expect(ticketQuery(client, '2680').queryKey).toEqual(queryKeys.ticket('2680'));
  });
});
