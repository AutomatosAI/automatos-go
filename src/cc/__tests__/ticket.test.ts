import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { approveTicket } from '../board/api';
import { BOARD_STATUSES } from '../board/board';
import { TicketDetailSchema, type TicketDetail } from '../board/schemas';
import { SEND_BACK_MAX_CHARS, VerdictInputError } from '../board/verdict';
import { BOARD_COPY, TICKET_COPY } from '../strings';
import {
  approveBody,
  approvedMessage,
  approveWords,
  readOnlyNote,
  refusalMessage,
  sendBackBody,
  sentBackMessage,
  ticketActions,
  verdictView,
  type TicketActions,
} from '../ticket/actions';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const WRITERS: readonly WorkspaceRole[] = ['owner', 'admin', 'editor'];
const ROLES: readonly (WorkspaceRole | null)[] = [...WORKSPACE_ROLES, null];
const STATUSES = [...BOARD_STATUSES, 'closed', 'waiting_on_host'];

// GET /api/v1/tasks/{task_id} at the pinned SHA (board_dict + agent + number + cost), parsed.
function detail(overrides: Record<string, unknown> = {}): TicketDetail {
  return TicketDetailSchema.parse({
    id: 2680,
    workspace_id: WS,
    workspace_seq: 1394,
    number: '#1394',
    title: 'Draft the launch post',
    description: 'Write the launch post for the autumn release.',
    status: 'review',
    priority: 'medium',
    source_type: 'user',
    tags: [],
    result: 'Here is the draft.',
    planning_data: null,
    review_reason: null,
    blocked_code: null,
    parent_task_id: null,
    times_sent_back: 0,
    created_at: '2026-10-22T08:00:00+00:00',
    updated_at: '2026-10-22T08:06:00+00:00',
    agent: { id: 7, name: 'Quill' },
    cost: { available: true, usd: 0.42, label: '$0.42' },
    ...overrides,
  });
}

const BOTH: TicketActions = { approve: true, sendBack: true, askAuto: true };
const NONE: TicketActions = { approve: false, sendBack: false, askAuto: true };

describe('which actions the ticket sheet shows', () => {
  it('offers Approve only in Review', () => {
    for (const status of STATUSES) {
      const actions = ticketActions(detail({ status }), 'owner');
      expect(actions.approve).toBe(status === 'review');
    }
  });

  it('offers Send back only in Review, beside Approve', () => {
    for (const status of STATUSES) {
      expect(ticketActions(detail({ status }), 'editor').sendBack).toBe(status === 'review');
    }
  });

  it('gives owners, admins and editors both verdicts on a ticket in Review', () => {
    for (const role of WRITERS) expect(ticketActions(detail(), role)).toEqual(BOTH);
  });

  it('gives a viewer none, and nothing before the role is known', () => {
    expect(ticketActions(detail(), 'viewer')).toEqual(NONE);
    expect(ticketActions(detail(), null)).toEqual(NONE);
    expect(ticketActions(detail(), undefined)).toEqual(NONE);
  });

  it('always offers Ask Auto about, for every status and every role', () => {
    for (const status of STATUSES) {
      for (const role of ROLES) expect(ticketActions(detail({ status }), role).askAuto).toBe(true);
    }
  });

  it("offers Approve alone on a mission's card: the server refuses to send it back", () => {
    const card = detail({ source_type: 'orchestration', review_reason: 'mission_plan' });
    expect(ticketActions(card, 'owner')).toEqual({ ...NONE, approve: true });
  });

  it('leaves a mission step to its mission, unless the owner asked to check it (F242)', () => {
    const checking = detail({
      source_type: 'orchestration_task',
      review_reason: 'mission_checking',
    });
    expect(ticketActions(checking, 'owner')).toEqual(NONE);
    const asked = detail({ source_type: 'orchestration_task', review_reason: 'asked' });
    expect(ticketActions(asked, 'owner')).toEqual(BOTH);
  });

  it('tells a viewer who decides a ticket in Review, and says nothing elsewhere', () => {
    expect(readOnlyNote(detail(), 'viewer')).toBe(TICKET_COPY.readOnly);
    expect(readOnlyNote(detail(), 'editor')).toBeNull();
    expect(readOnlyNote(detail({ status: 'done' }), 'viewer')).toBeNull();
    expect(readOnlyNote(detail(), null)).toBeNull();
  });
});

describe('the verdict panel', () => {
  it('shows Send back and Approve, named for what approving does', () => {
    const view = verdictView(BOTH, 'idle', '', false, 'Approve and mark done');
    expect(view).toEqual({
      note: { open: false, error: null },
      secondary: { label: TICKET_COPY.sendBack, disabled: false },
      primary: { label: 'Approve and mark done', disabled: false },
    });
  });

  it('Send back requires feedback: blank keeps it disabled, words enable it', () => {
    const blank = verdictView(BOTH, 'note', '   ', false, 'Approve');
    expect(blank.note).toEqual({ open: true, error: null });
    expect(blank.secondary).toEqual({ label: TICKET_COPY.cancel, disabled: false });
    expect(blank.primary).toEqual({ label: TICKET_COPY.sendBack, disabled: true });
    const words = verdictView(BOTH, 'note', 'Use the Q3 figures', false, 'Approve');
    expect(words.primary).toEqual({ label: TICKET_COPY.sendBack, disabled: false });
  });

  it('says why a note longer than the server keeps cannot be sent', () => {
    const view = verdictView(BOTH, 'note', 'x'.repeat(SEND_BACK_MAX_CHARS + 1), false, 'Approve');
    expect(view.note.error).toBe(BOARD_COPY.feedbackTooLong(SEND_BACK_MAX_CHARS));
    expect(view.primary?.disabled).toBe(true);
  });

  it('disables every control while a verdict is out', () => {
    const idle = verdictView(BOTH, 'idle', '', true, 'Approve');
    expect([idle.primary?.disabled, idle.secondary?.disabled]).toEqual([true, true]);
    const noting = verdictView(BOTH, 'note', 'Fix it', true, 'Approve');
    expect([noting.primary?.disabled, noting.secondary?.disabled]).toEqual([true, true]);
  });

  it('shows no button to a viewer, and never the note', () => {
    expect(verdictView(NONE, 'idle', '', false, 'Approve')).toEqual({
      note: { open: false, error: null },
      secondary: null,
      primary: null,
    });
    expect(verdictView(NONE, 'note', 'words', false, 'Approve').note.open).toBe(false);
  });

  it("shows Approve alone on a mission's card", () => {
    const view = verdictView({ ...NONE, approve: true }, 'idle', '', false, 'Approve the plan');
    expect(view.secondary).toBeNull();
    expect(view.primary).toEqual({ label: 'Approve the plan', disabled: false });
  });
});

describe('verdict payloads', () => {
  it('approves with no note as {} and with words as {note}', () => {
    expect(approveBody()).toEqual({});
    expect(approveBody('  Ship it  ')).toEqual({ note: 'Ship it' });
  });

  it('sends back only with words, trimmed', () => {
    expect(sendBackBody('  ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(sendBackBody(' Use the Q3 figures ')).toEqual({
      ok: true,
      body: { feedback: 'Use the Q3 figures' },
    });
  });
});

describe('the Approve button names its effect', () => {
  it('marks done by default', () => {
    expect(approveWords(detail())).toEqual({
      label: TICKET_COPY.approve.done,
      effect: TICKET_COPY.effect.done,
    });
  });

  it('publishes a blog post, or starts one on its topic', () => {
    const publish = detail({ planning_data: { approval_action: { type: 'publish_blog' } } });
    expect(approveWords(publish).label).toBe(TICKET_COPY.approve.publish);
    const start = detail({
      planning_data: { approval_action: { type: 'create_blog', topic: 'Autumn release' } },
    });
    expect(approveWords(start)).toEqual({
      label: TICKET_COPY.approve.startPost,
      effect: TICKET_COPY.effect.startPostOn('Autumn release'),
    });
  });

  it("approves a mission's plan from its card", () => {
    const card = detail({ source_type: 'orchestration', review_reason: 'mission_plan' });
    expect(approveWords(card).label).toBe(TICKET_COPY.approve.plan);
  });

  it('reads an approval action it cannot parse as none', () => {
    const odd = detail({ planning_data: { approval_action: { topic: 'no type' } } });
    expect(approveWords(odd).label).toBe(TICKET_COPY.approve.done);
    expect(detail({ planning_data: 'not an object' }).planning_data).toBeNull();
  });
});

describe('the words a decision ends with', () => {
  it('names the ticket by its number, never its row id', () => {
    expect(approvedMessage({ status: 'done', message: null }, detail())).toBe(
      'Approved. Ticket #1394 is done.',
    );
    expect(approvedMessage(undefined, detail({ number: null, workspace_seq: null }))).toBe(
      'Approved. This ticket is done.',
    );
  });

  it("says the server's own words when it sent any (a mission's plan)", () => {
    const said = 'Approved the plan of ticket #0051: the mission is starting.';
    expect(approvedMessage({ status: 'review', message: said }, detail())).toBe(said);
  });

  it('says what an approval action did', () => {
    const published = { type: 'publish_blog', title: 'Autumn', topic: null, warning: null };
    expect(
      approvedMessage({ status: 'done', message: null, action_result: published }, detail()),
    ).toBe(TICKET_COPY.approved.publishedTitle('Autumn'));
    const started = { type: 'create_blog', title: null, topic: 'Autumn', warning: null };
    expect(
      approvedMessage({ status: 'done', message: null, action_result: started }, detail()),
    ).toBe(TICKET_COPY.approved.startedOn('Autumn'));
  });

  it('names the agent a ticket is sent back to', () => {
    expect(sentBackMessage('Quill')).toBe(TICKET_COPY.sentBack('Quill'));
    expect(sentBackMessage(null)).toBe(TICKET_COPY.sentBack(TICKET_COPY.theAgent));
  });
});

describe("a refusal's words", () => {
  it("shows the note's own words for a refusal made before sending", () => {
    expect(refusalMessage(new VerdictInputError('empty', BOARD_COPY.feedbackRequired))).toBe(
      BOARD_COPY.feedbackRequired,
    );
  });

  it("shows the server's words on a 409 or a 422", () => {
    const outside = new ApiError('server', {
      status: 422,
      serverMessage: 'Ticket #1394 is In progress: only a ticket in Review can be approved.',
    });
    expect(refusalMessage(outside)).toBe(outside.serverMessage);
    const decided = new ApiError('conflict', { status: 409, serverMessage: 'Already decided.' });
    expect(refusalMessage(decided)).toBe('Already decided.');
  });

  it("shows the taxonomy's copy otherwise", () => {
    expect(refusalMessage(new ApiError('server', { status: 422 }))).toBe(API_ERROR_COPY.server);
    expect(refusalMessage(new ApiError('forbidden', { status: 403, serverMessage: 'no' }))).toBe(
      API_ERROR_COPY.forbidden,
    );
    expect(refusalMessage(new ApiError('network'))).toBe(API_ERROR_COPY.network);
    expect(refusalMessage(new Error('boom'))).toBe(API_ERROR_COPY.server);
  });

  it("reads a real 422 from the approve route in the server's words", async () => {
    const words = 'Ticket #1394 is Assigned: only a ticket in Review can be approved.';
    const transport = fakeTransport(() => jsonReply(422, { detail: words }));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'token',
      getWorkspaceId: () => WS,
      transport,
    });
    const refused = await approveTicket(client, 2680).catch((error: unknown) => error);
    expect(refusalMessage(refused)).toBe(words);
  });
});
