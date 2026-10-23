import { describe, expect, it } from 'vitest';

import {
  SERVER,
  fakeTransport,
  jsonReply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { discussionOf, type Discussion } from '../../core/web/lib/discussion';
import type { ChatMessage } from '../../core/web/types';
import { chatWithTicket, routes } from '../../navigation/routes';
import { refusalText } from '../cards/actions';
import {
  MAX_BRIEF_CHARS,
  canRebrief,
  discussionBar,
  discussionHolds,
  discussionInput,
  rebriefBody,
  rebriefDoneText,
  rebriefPrefill,
  rebriefSheetCopy,
  routeTicketId,
  type DiscussionLoad,
} from '../discussion/discussion';
import { TicketSchema, fetchTicket, rebriefTicket } from '../discussion/ticket';
import { buildChatRequest } from '../request';

const API = SERVER.apiUrl;
const WEB = 'https://studio.example.test';
const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c001';
const RUN_ID = '5d2f0c3a-0000-4000-8000-00000000a001';

/** GET /api/v1/tasks/419 as api/board_tasks.py get_task answers it (cost line included). */
const WIRE = Object.freeze({
  id: 419,
  workspace_id: '7f1c2a54-0000-4000-8000-000000000001',
  workspace_seq: 419,
  title: 'Draft the launch post',
  description: 'Two paragraphs and a link.',
  status: 'review',
  priority: 'high',
  review_mode: 'human',
  assigned_agent_id: 7,
  source_type: 'manual',
  source_id: null,
  orchestration_run_id: null,
  tags: ['launch', 'mission:Spring'],
  number: '#0419',
  times_sent_back: 3,
  agent: { id: 7, name: 'Ada', agent_icon: null },
  cost: { available: true, usd: 1.23, label: '$1.23 · 4,000 tokens · 3 calls' },
});

const ticketOf = (overrides: Record<string, unknown> = {}) =>
  TicketSchema.parse({ ...WIRE, ...overrides });
const discussionWith = (overrides: Record<string, unknown> = {}): Discussion =>
  discussionOf(ticketOf(overrides));

const loaded = (overrides: Record<string, unknown> = {}): DiscussionLoad => ({
  ticketId: '419',
  ticket: ticketOf(overrides),
  error: null,
});

function clientWith(transport: FakeTransport) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => 'ws-1',
    transport,
  });
}

function reply(text: string): ChatMessage {
  return { id: 'm-2', role: 'assistant', parts: [{ type: 'text', text }] } as ChatMessage;
}

describe('the ticket (GET /api/v1/tasks/{task_id})', () => {
  it('is read as the web reads it, its number and agent kept and its cost line dropped (D8)', () => {
    const ticket = ticketOf();
    expect(ticket).not.toHaveProperty('cost');
    expect(ticket.tags).toEqual(['launch']);
    expect(discussionOf(ticket)).toEqual({
      ticketId: '419',
      number: '#0419',
      title: 'Draft the launch post',
      agentName: 'Ada',
      missionId: null,
    });
  });

  it('takes its board number from workspace_seq, and never shows a row id as one (F414)', () => {
    expect(discussionWith({ number: null }).number).toBe('#0419');
    expect(discussionWith({ number: null, workspace_seq: null }).number).toBeNull();
    const step = { number: null, source_type: 'orchestration_task' };
    expect(discussionWith(step).number).toBeNull();
  });

  it('names the Mission of a Mission’s ticket, and reads a missing title and agent', () => {
    const mission = discussionWith({ source_type: 'orchestration', orchestration_run_id: RUN_ID });
    expect(mission.missionId).toBe(RUN_ID);
    const bare = discussionWith({ title: null, agent: null, status: 'brand_new' });
    expect(bare).toMatchObject({ title: 'Untitled', agentName: null });
  });

  it('is fetched by its row id', async () => {
    const transport = fakeTransport(() => jsonReply(200, WIRE));
    const ticket = await fetchTicket(clientWith(transport), '419');
    expect(transport.calls[0]).toMatchObject({ url: `${API}/api/v1/tasks/419`, method: 'GET' });
    expect(ticket.number).toBe('#0419');
  });
});

describe('the request carries the selection (context.selected = discussionSelection)', () => {
  it('selects the ticket by its board number on the draft and on every message after it', () => {
    const discussion = discussionWith();
    const first = buildChatRequest({
      ...discussionInput({ text: 'Why was it sent back?' }, discussion),
    });
    expect(first).not.toHaveProperty('id');
    expect(first.context).toEqual({
      page: 'chat',
      route: '/chat',
      selected: { type: 'board_task', id: '#0419' },
    });
    const next = buildChatRequest({
      ...discussionInput({ text: 'Shorter.' }, discussion),
      chatId: CHAT_ID,
    });
    expect(next).toMatchObject({
      id: CHAT_ID,
      context: { selected: { type: 'board_task', id: '#0419' } },
    });
  });

  it('selects the Mission on a Mission’s ticket, and the row id on a ticket with no number', () => {
    const mission = discussionWith({ orchestration_run_id: RUN_ID, source_type: 'orchestration' });
    const onMission = buildChatRequest(discussionInput({ text: 'Is the plan right?' }, mission));
    expect(onMission.context.selected).toEqual({ type: 'mission', id: RUN_ID });
    const unnumbered = discussionWith({ number: null, workspace_seq: null });
    const onTicket = buildChatRequest(discussionInput({ text: 'Hi' }, unnumbered));
    expect(onTicket.context.selected).toEqual({ type: 'board_task', id: '419' });
  });

  it('sends no selection once the discussion has ended, and leaves the input as it was', () => {
    const input = Object.freeze({ text: 'Hello', context: Object.freeze({ route: '/chat' }) });
    expect(discussionInput(input, null)).toBe(input);
    const sent = discussionInput(input, discussionWith());
    expect(sent).not.toBe(input);
    expect(input.context).toEqual({ route: '/chat' });
    expect(buildChatRequest(discussionInput({ text: 'Hello' }, null)).context).not.toHaveProperty(
      'selected',
    );
  });
});

describe('the route', () => {
  it('discusses the ticket of a draft only (routes.chatWithTicket, or /chat/new?ticket=…)', () => {
    expect(routeTicketId({ ticket: '419' })).toBe('419');
    expect(routeTicketId({ id: 'new', ticket: '419' })).toBe('419');
    expect(routeTicketId({ id: 'new', ticket: ' 419 ' })).toBe('419');
    expect(chatWithTicket(419)).toBe('/chat?ticket=419');
  });

  it('discusses nothing in a named conversation, with no ticket, or with a ticket that is no row id', () => {
    expect(routeTicketId({ id: CHAT_ID, ticket: '419' })).toBeNull();
    expect(routeTicketId({ id: 'new' })).toBeNull();
    expect(routeTicketId({ id: 'new', ticket: '#0419' })).toBeNull();
    expect(routeTicketId({ id: 'new', ticket: undefined })).toBeNull();
  });
});

describe('the bar', () => {
  const owner = { role: 'owner' as const, webUrl: WEB };

  it('reads "Discussing #0419 — <title>", opens the ticket and offers the rebrief to an approver', () => {
    for (const role of ['owner', 'admin', 'editor'] as const) {
      expect(discussionBar(loaded(), { role, webUrl: WEB })).toEqual({
        kind: 'open',
        title: 'Discussing #0419 — Draft the launch post',
        ticketRoute: routes.cc.ticket('419'),
        action: { kind: 'rebrief' },
      });
    }
    const unnumbered = discussionBar(loaded({ number: null, workspace_seq: null }), owner);
    expect(unnumbered).toMatchObject({ title: 'Discussing this ticket — Draft the launch post' });
  });

  it('offers no rebrief to a viewer, or before the role is read (D17)', () => {
    expect(discussionBar(loaded(), { role: 'viewer' })).toMatchObject({ action: { kind: 'none' } });
    expect(discussionBar(loaded(), { role: null })).toMatchObject({ action: { kind: 'none' } });
  });

  it('points a Mission’s ticket at the Mission in Studio instead (PRD-252 D4)', () => {
    const mission = loaded({ source_type: 'orchestration', orchestration_run_id: RUN_ID });
    expect(discussionBar(mission, owner)).toMatchObject({
      action: { kind: 'mission', target: { external: `${WEB}/missions/${RUN_ID}` } },
    });
    expect(discussionBar(mission, { role: 'owner', webUrl: '' })).toMatchObject({
      action: { kind: 'mission', target: null },
    });
  });

  it('is gone with no ticket, and says the ticket is opening while it loads', () => {
    expect(discussionBar({ ticketId: null, ticket: undefined, error: null }, owner)).toEqual({
      kind: 'none',
    });
    const opening = { ticketId: '419', ticket: undefined, error: null };
    expect(discussionBar(opening, owner)).toEqual({ kind: 'loading', text: 'Opening the ticket…' });
  });

  it('says a missing ticket may be in another workspace, by the id the link carried', () => {
    const missing = {
      ticketId: '419',
      ticket: undefined,
      error: new ApiError('not_found', { status: 404 }),
    };
    expect(discussionBar(missing, owner)).toEqual({
      kind: 'missing',
      text: 'Ticket 419 could not be opened here. It may be in another workspace.',
    });
  });

  it('shows any other failure in the taxonomy’s words, with Try again', () => {
    const failed = { ticketId: '419', ticket: undefined, error: new ApiError('network') };
    expect(discussionBar(failed, owner)).toEqual({
      kind: 'failed',
      text: API_ERROR_COPY.network,
      canRetry: true,
    });
  });
});

describe('the composer while the ticket opens', () => {
  it('holds the send until the ticket is in, or while it failed; a missing one lets the chat go on', () => {
    const opening = { ticketId: '419', ticket: undefined, error: null };
    expect(discussionHolds(opening)).toBe(true);
    expect(discussionHolds({ ...opening, error: new ApiError('server', { status: 500 }) })).toBe(
      true,
    );
    expect(discussionHolds({ ...opening, error: new ApiError('not_found', { status: 404 }) })).toBe(
      false,
    );
    expect(discussionHolds(loaded())).toBe(false);
    expect(discussionHolds({ ticketId: null, ticket: undefined, error: null })).toBe(false);
  });
});

describe('the brief (proposedBrief, capped at MAX_BRIEF_CHARS)', () => {
  it('opens on the fenced block of Auto’s last reply', () => {
    const messages = [
      reply('First go:\n```\nLonger.\n```'),
      { id: 'm-3', role: 'user', parts: [{ type: 'text', text: 'ok' }] } as ChatMessage,
      reply('Agreed brief:\n```text\nTwo paragraphs, one link.\n```\nShall I re-queue it?'),
    ];
    expect(rebriefPrefill(messages)).toBe('Two paragraphs, one link.');
    expect(rebriefPrefill([])).toBe('');
  });

  it('is cut to the server’s bound', () => {
    const long = 'a'.repeat(MAX_BRIEF_CHARS + 500);
    expect(MAX_BRIEF_CHARS).toBe(8000);
    expect(rebriefPrefill([reply(long)])).toHaveLength(MAX_BRIEF_CHARS);
  });

  it('is sent trimmed, never blank and never over the bound', () => {
    expect(rebriefBody('  Two paragraphs.\n')).toEqual({ brief: 'Two paragraphs.' });
    expect(rebriefBody(' \n ')).toBeNull();
    expect(rebriefBody('a'.repeat(MAX_BRIEF_CHARS))).toEqual({
      brief: 'a'.repeat(MAX_BRIEF_CHARS),
    });
    expect(rebriefBody('a'.repeat(MAX_BRIEF_CHARS + 1))).toBeNull();
  });

  it('is saved only by a role that may approve, once there is one', () => {
    expect(canRebrief('editor', 'Two paragraphs.')).toBe(true);
    expect(canRebrief('editor', '  ')).toBe(false);
    expect(canRebrief('viewer', 'Two paragraphs.')).toBe(false);
    expect(canRebrief(undefined, 'Two paragraphs.')).toBe(false);
  });
});

describe('the rebrief (POST /api/v1/tasks/{task_id}/rebrief)', () => {
  it('sends {brief} for the ticket and reads the answer', async () => {
    const transport = fakeTransport(() =>
      jsonReply(200, { success: true, task_id: 419, status: 'assigned' }),
    );
    const body = rebriefBody(' Two paragraphs, one link. ');
    if (!body) throw new Error('expected a body');
    const result = await rebriefTicket(clientWith(transport), '419', body);
    expect(transport.calls[0]).toMatchObject({
      url: `${API}/api/v1/tasks/419/rebrief`,
      method: 'POST',
      body: JSON.stringify({ brief: 'Two paragraphs, one link.' }),
    });
    expect(result).toEqual({ task_id: 419, status: 'assigned' });
  });

  it('shows a refusal a person wrote, and the taxonomy’s words for anything else', async () => {
    const running = 'Ticket #0419 is running; re-brief it once it stops.';
    const conflict = fakeTransport(() => jsonReply(409, { detail: running }));
    const refused = await rebriefTicket(clientWith(conflict), '419', { brief: 'x' }).catch(
      (e: unknown) => e,
    );
    expect(refusalText(refused)).toBe(running);
    const invalid = fakeTransport(() =>
      jsonReply(422, { detail: [{ loc: ['body', 'brief'], type: 'string_too_long' }] }),
    );
    const rejected = await rebriefTicket(clientWith(invalid), '419', { brief: 'x' }).catch(
      (e: unknown) => e,
    );
    expect(refusalText(rejected)).toBe(API_ERROR_COPY.server);
  });

  it('names the ticket and its agent in the sheet and the toast', () => {
    expect(rebriefSheetCopy(discussionWith())).toEqual({
      title: 'Update ticket #0419 and re-queue',
      intro:
        "This brief replaces the ticket's, and Ada redoes the ticket from it. The old brief and the last draft stay on the ticket.",
    });
    expect(rebriefDoneText(discussionWith())).toBe(
      'Ticket #0419 is back with Ada, working from the brief you agreed.',
    );
    const bare = discussionWith({ number: null, workspace_seq: null, agent: null });
    expect(rebriefSheetCopy(bare).title).toBe('Update this ticket and re-queue');
    expect(rebriefDoneText(bare)).toBe(
      'This ticket is back with its agent, working from the brief you agreed.',
    );
  });
});
