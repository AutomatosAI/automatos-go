import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { routes } from '../../navigation/routes';
import { TicketDetailSchema, type TicketDetail } from '../board/schemas';
import { BOARD_COPY, TICKET_COPY } from '../strings';
import {
  fetchLinkedDeliverables,
  LINKED_DELIVERABLES_LIMIT,
  LinkedDeliverablesSchema,
  linkedDeliverablesQuery,
  linkedDeliverableViews,
} from '../ticket/linked';
import { cutText, taskIdParam, TEXT_CUT_CHARS, ticketSheetView } from '../ticket/sheet';
import { updatedWord } from '../ticket/updated';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const UUID = '0b6f9d1e-1111-4a2b-8c3d-000000000042';
// Thursday 22 Oct 2026, 10:00 UTC.
const NOW = new Date('2026-10-22T10:00:00Z');
const CLOCK = { now: NOW, timeZone: 'UTC' };

function detail(overrides: Record<string, unknown> = {}): TicketDetail {
  return TicketDetailSchema.parse({
    id: 2680,
    number: '#0419',
    workspace_seq: 419,
    title: 'Reconcile October invoices',
    description: '  Match Stripe payouts against invoices.  ',
    status: 'in_progress',
    priority: 'high',
    source_type: 'user',
    tags: ['finance'],
    result: null,
    error_message: null,
    review_reason: null,
    blocked_code: null,
    parent_task_id: null,
    times_sent_back: 0,
    created_at: '2026-10-22T06:00:00Z',
    updated_at: '2026-10-22T08:06:00Z',
    agent: { id: 3, name: 'Ledger' },
    ...overrides,
  });
}

function clientAnswering(body: unknown) {
  const transport = fakeTransport(() => jsonReply(200, body));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

describe('the ticket route', () => {
  it('reads the row id from the route, and nothing else', () => {
    expect(taskIdParam({ taskId: '2680' })).toBe('2680');
    expect(taskIdParam({ taskId: [' 2680 ', '1'] })).toBe('2680');
    expect(taskIdParam({ taskId: '#0419' })).toBeNull();
    expect(taskIdParam({ taskId: '../x' })).toBeNull();
    expect(taskIdParam({})).toBeNull();
  });
});

describe('the ticket sheet view', () => {
  it("has the card's kind row and title, the agent and when it was updated", () => {
    const view = ticketSheetView(detail(), CLOCK);
    expect(view.card).toMatchObject({
      number: '#0419',
      kindWord: 'Task',
      priority: 'High',
      status: { pip: 'in_progress', word: 'In Progress' },
      title: 'Reconcile October invoices',
    });
    expect(view.byline).toBe('Ledger · updated 08:06');
    expect(view.description).toBe('Match Stripe payouts against invoices.');
  });

  it('names the agent alone when no time can be read, and Unassigned with no agent', () => {
    const view = ticketSheetView(
      detail({ updated_at: null, created_at: null, agent: null }),
      CLOCK,
    );
    expect(view.byline).toBe(BOARD_COPY.unassigned);
  });

  it('opens Ask Auto about #number as a chat with the ticket as its context', () => {
    const view = ticketSheetView(detail(), CLOCK);
    expect(view.ask).toEqual({
      label: 'Ask Auto about #0419',
      href: routes.chatWithTicket(2680),
    });
    expect(view.ask.href).toBe('/chat?ticket=2680');
    const unnumbered = ticketSheetView(detail({ number: null, workspace_seq: null }), CLOCK);
    expect(unnumbered.ask.label).toBe(TICKET_COPY.askAboutThis);
  });

  it("shows the 'Waiting for your answer' box on a ticket blocked on a question", () => {
    const view = ticketSheetView(detail({ status: 'blocked', blocked_code: 'question' }), CLOCK);
    expect(view.question).toBe(true);
    expect(view.reason).toBeNull();
    expect(ticketSheetView(detail({ status: 'blocked' }), CLOCK).question).toBe(false);
  });

  it('says why a ticket waits in Review or Blocked', () => {
    const review = ticketSheetView(
      detail({ status: 'review', review_reason: 'file_missing' }),
      CLOCK,
    );
    expect(review.reason).toEqual({
      chip: 'File missing',
      says: 'The file it named is not in the workspace. Check the result before you approve it.',
    });
    expect(ticketSheetView(detail(), CLOCK).reason).toBeNull();
  });

  it('shows what it handed in, and why it failed only when it failed', () => {
    const review = ticketSheetView(detail({ status: 'review', result: ' The draft. ' }), CLOCK);
    expect(review.result).toBe('The draft.');
    const failed = detail({ status: 'failed', error_message: 'Timed out' });
    expect(ticketSheetView(failed, CLOCK).failure).toBe('Timed out');
    const retried = detail({ status: 'in_progress', error_message: 'Timed out' });
    expect(ticketSheetView(retried, CLOCK).failure).toBeNull();
  });

  it('cuts a long text, and reads blank as none', () => {
    const long = 'x'.repeat(TEXT_CUT_CHARS + 50);
    expect(cutText(long)).toBe(`${'x'.repeat(TEXT_CUT_CHARS)}${TICKET_COPY.cut}`);
    expect(cutText('  ')).toBeNull();
    expect(cutText(null)).toBeNull();
  });

  it('suggests talking it through after three send-backs', () => {
    expect(ticketSheetView(detail({ times_sent_back: 2 }), CLOCK).discussHint).toBeNull();
    expect(ticketSheetView(detail({ times_sent_back: 3 }), CLOCK).discussHint).toBe(
      TICKET_COPY.sentBackTimes(3),
    );
  });

  it('names the ticket by its number, never its row id', () => {
    const view = ticketSheetView(detail(), CLOCK);
    expect(view.card.href).toBe(routes.cc.ticket(2680));
    expect(view.ask.label).not.toContain('2680');
  });
});

describe('when a ticket was updated', () => {
  it('is the time today, Yesterday, a weekday this week, else the date', () => {
    expect(updatedWord('2026-10-22T08:06:00Z', NOW, 'UTC')).toBe('08:06');
    expect(updatedWord('2026-10-21T23:00:00Z', NOW, 'UTC')).toBe('Yesterday');
    expect(updatedWord('2026-10-16T12:00:00Z', NOW, 'UTC')).toBe('Fri');
    expect(updatedWord('2026-10-14T12:00:00Z', NOW, 'UTC')).toBe('14 Oct');
  });

  it("reads the day in the phone's timezone", () => {
    // 23:00 UTC on the 21st is 08:00 on the 22nd in Tokyo, the same day as now there (19:00)
    expect(updatedWord('2026-10-21T23:00:00Z', NOW, 'Asia/Tokyo')).toBe('08:00');
  });

  it('says a time ahead of the clock as the time today, else its date', () => {
    expect(updatedWord('2026-10-22T11:00:00Z', NOW, 'UTC')).toBe('11:00');
    expect(updatedWord('2026-10-23T11:00:00Z', NOW, 'UTC')).toBe('23 Oct');
  });

  it('says nothing for no time or one that does not parse', () => {
    expect(updatedWord(null, NOW, 'UTC')).toBeNull();
    expect(updatedWord('yesterday-ish', NOW, 'UTC')).toBeNull();
  });
});

describe("the ticket's Deliverables", () => {
  const ROW = {
    id: UUID,
    title: 'October reconciliation',
    artifact_type: 'spreadsheet',
    status: 'ready',
    file_path: 'reports/october.xlsx',
  };

  it('asks for the files registered against the ticket, by its row id', async () => {
    const { client, transport } = clientAnswering({ success: true, deliverables: [ROW], total: 1 });
    const rows = await fetchLinkedDeliverables(client, '2680');
    expect(rows).toEqual([
      { id: UUID, title: 'October reconciliation', artifact_type: 'spreadsheet' },
    ]);
    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      url: `${SERVER.apiUrl}/api/deliverables?source_id=2680&limit=${LINKED_DELIVERABLES_LIMIT}`,
    });
  });

  it('keys them in the shared, persisted Deliverables family', () => {
    const { client } = clientAnswering({});
    expect(linkedDeliverablesQuery(client, WS, '2680').queryKey).toEqual(
      queryKeys.deliverables(WS, { source_id: '2680', limit: LINKED_DELIVERABLES_LIMIT }),
    );
  });

  it('leaves out a row it cannot read, never the list', () => {
    const parsed = LinkedDeliverablesSchema.parse({
      deliverables: [ROW, { title: 'no id' }, { id: '..', title: 'dot' }, 'junk'],
    });
    expect(parsed.deliverables.map((row) => row.id)).toEqual([UUID]);
  });

  it('opens each one: a title, its type as a word, the Deliverable route', () => {
    const [view] = linkedDeliverableViews([{ id: UUID, title: ' ', artifact_type: 'slide_deck' }]);
    expect(view).toEqual({
      id: UUID,
      title: BOARD_COPY.untitled,
      kind: 'Slide deck',
      href: routes.cc.deliverable(UUID),
      accessibilityLabel: `${BOARD_COPY.untitled}, Slide deck`,
    });
    expect(
      linkedDeliverableViews([{ id: UUID, title: 'T', artifact_type: null }])[0].kind,
    ).toBeNull();
  });
});
