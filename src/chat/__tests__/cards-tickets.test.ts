import { describe, expect, it } from 'vitest';

import type { TaskCardData } from '../../core/web/types';
import { routes } from '../../navigation/routes';
import { ticketRow, ticketRows } from '../cards/view-tools';
import type { ThreadState } from '../controller/thread';
import { TICKET_COPY } from '../strings';
import { threadRows } from '../view-model';
import { saved } from './thread-fixtures';
import { WEB, autoRows, opened, streaming } from './view-model-fixtures';

const TICKET: TaskCardData = {
  id: 2680,
  number: '#0431',
  title: 'Answer the cafe questions',
  status: 'inbox',
  assigned_agent: 'unassigned',
};

const rowsOf = (state: ThreadState) => autoRows(threadRows(state, { webUrl: WEB }));

describe("the ticket card: '#0431: filed to Inbox' and the board's ticket sheet", () => {
  it('reads a filed ticket as the handoff does and links to cc.ticket', () => {
    expect(ticketRow(TICKET)).toEqual({
      key: 'ticket-2680',
      headline: `#0431: ${TICKET_COPY.filedToInbox}`,
      title: 'Answer the cafe questions',
      facts: null,
      link: { app: routes.cc.ticket(2680) },
      accessibilityLabel: `#0431: ${TICKET_COPY.filedToInbox}, Answer the cafe questions`,
    });
    expect(routes.cc.ticket(2680)).toBe('/cc/ticket/2680');
  });

  it("names any other stage by the board's column, and what the ticket did", () => {
    const row = ticketRow({
      ...TICKET,
      status: 'in_progress',
      assigned_agent: 'Scout',
      last_tool: 'Edit',
      files_touched: 3,
      exit_reason: 'max_turns',
    });
    expect(row.headline).toBe('#0431: In Progress');
    expect(row.facts).toBe('Scout · last tool: Edit · 3 files touched · exit: max_turns');
    expect(ticketRow({ ...TICKET, status: 'closed' }).headline).toBe('#0431: closed');
  });

  it('never shows a row id as a number, and links only a board row id', () => {
    expect(ticketRow({ ...TICKET, number: null }).headline).toBe(
      `${TICKET_COPY.unnumbered}: ${TICKET_COPY.filedToInbox}`,
    );
    expect(ticketRow({ ...TICKET, id: -3 }).link).toBeNull();
  });

  it('draws a saved task_card part and a live one, each ticket once', () => {
    const reply = {
      ...saved('m-replied', 'assistant', 'Filed.'),
      parts: [
        { type: 'text' as const, text: 'Filed.' },
        { type: 'task_card' as const, card: TICKET },
      ],
    };
    const state = opened([saved('m-asked', 'user', 'File it.'), reply]);
    expect(rowsOf(state).flatMap((row) => row.tickets.map((ticket) => ticket.key))).toContain(
      'ticket-2680',
    );
    const live = streaming(
      { kind: 'tool-data', taskCard: TICKET, approvals: [], deliverables: [] },
      {
        kind: 'tool-data',
        taskCard: { ...TICKET, status: 'assigned' },
        approvals: [],
        deliverables: [],
      },
    );
    const tickets = rowsOf(live).flatMap((row) => row.tickets);
    expect(tickets.map((ticket) => ticket.headline)).toEqual(['#0431: Assigned']);
    expect(ticketRows([TICKET, TICKET])).toHaveLength(1);
  });
});
