// A row's status (PRD-268 §6.11.1, §6.12.3, US-G05): the server's state or nothing (never a
// placeholder), its next step as written, Try again only to a core route the pin serves and only
// with the id it needs, VoiceOver's '<word>: <title>. <next step>.', the mark per layout, and the
// call: one POST with no body, the server's words in the toast.

import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { DISPLAY_STATES, RETRY_KINDS } from '../../api/row-status';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import manifest from '../../core/route-manifest.json';
import { STATE_WORDS } from '../../styles/strings';
import { BoardSchema, TicketDetailSchema } from '../board/schemas';
import { CC_ROUTES } from '../routes';
import { RetryResultSchema, retriedMessage, sendRetry } from '../status/api';
import {
  RETRY_ROUTES,
  retryAction,
  rowStatusView,
  stateMark,
  statusLabel,
} from '../status/row-status';
import { STATUS_ROW_COPY } from '../strings';

const MISSION = 'a2b4c6d8-0000-4000-8000-000000000003';
const BOTH = { ticketId: 2680, missionId: MISSION };
const SERVED = new Set(manifest.routes.map((route) => `${route.method} ${route.path}`));

/** A board row as board_dict serves it, with the fields given. */
const boardRow = (fields: Record<string, unknown>) => ({
  id: 2680,
  title: 'Reconcile invoices',
  status: 'failed',
  priority: 'medium',
  tags: [],
  ...fields,
});

describe('board reads carry the status fields (US-C17)', () => {
  it("reads them, and a server's row without them as before", () => {
    const [withThem, without] = BoardSchema.parse({
      tasks: [
        boardRow({
          orchestration_run_id: MISSION,
          display_state: 'failed',
          next_step: 'The search tool timed out.',
          retry: { kind: 'rerun_mission' },
        }),
        boardRow({}),
      ],
    }).tasks;
    expect(withThem).toMatchObject({
      orchestration_run_id: MISSION,
      display_state: 'failed',
      next_step: 'The search tool timed out.',
      retry: { kind: 'rerun_mission' },
    });
    for (const field of ['display_state', 'next_step', 'retry']) {
      expect(without, field).not.toHaveProperty(field);
    }
    const detail = TicketDetailSchema.parse(boardRow({ display_state: 'done', retry: null }));
    expect(detail).toMatchObject({ display_state: 'done', retry: null });
  });

  it('reads a value this version does not know as null, never the row as unreadable', () => {
    const [odd] = BoardSchema.parse({
      tasks: [boardRow({ display_state: 'snoozed', next_step: 42, retry: { kind: 'reboot' } })],
    }).tasks;
    expect(odd).toMatchObject({ id: 2680, display_state: null, next_step: null, retry: null });
  });
});

describe('rowStatusView', () => {
  it('draws nothing without a state, or with one this version read as null', () => {
    expect(rowStatusView({}, 'Title', BOTH)).toBeNull();
    expect(rowStatusView({ display_state: null, next_step: 'Soon.' }, 'Title', BOTH)).toBeNull();
  });

  it('draws every state, with its next step as written', () => {
    for (const state of DISPLAY_STATES) {
      const view = rowStatusView({ display_state: state, next_step: '42 of 60 made' }, 'T', BOTH);
      expect(view, state).toMatchObject({ state, next: '42 of 60 made', retry: null });
      expect(view?.accessibilityLabel).toBe(`${STATE_WORDS[state]}: T. 42 of 60 made.`);
    }
  });

  it('has no next step when the server sent none', () => {
    const view = rowStatusView({ display_state: 'done' }, 'Launch post', BOTH);
    expect(view).toEqual({
      state: 'done',
      next: null,
      retry: null,
      accessibilityLabel: 'Done: Launch post.',
    });
  });
});

describe('retryAction', () => {
  it('sends each kind to its core route, with the id it names', () => {
    expect(retryAction({ kind: 'retry_ticket' }, BOTH)).toEqual({
      kind: 'retry_ticket',
      route: CC_ROUTES.board.runNow,
      params: { task_id: '2680' },
    });
    expect(retryAction({ kind: 'rerun_mission' }, BOTH)).toEqual({
      kind: 'rerun_mission',
      route: CC_ROUTES.missions.resume,
      params: { mission_id: MISSION },
    });
    expect(retryAction({ kind: 'replan_mission' }, BOTH)).toEqual({
      kind: 'replan_mission',
      route: CC_ROUTES.missions.replan,
      params: { mission_id: MISSION },
    });
  });

  it('offers none without a retry, or without the id its kind needs', () => {
    expect(retryAction(null, BOTH)).toBeNull();
    expect(retryAction(undefined, BOTH)).toBeNull();
    expect(
      retryAction({ kind: 'retry_ticket' }, { ticketId: null, missionId: MISSION }),
    ).toBeNull();
    expect(retryAction({ kind: 'retry_ticket' }, { ticketId: -3, missionId: null })).toBeNull();
    expect(retryAction({ kind: 'rerun_mission' }, { ticketId: 2680, missionId: '  ' })).toBeNull();
    expect(retryAction({ kind: 'replan_mission' }, { ticketId: 2680, missionId: null })).toBeNull();
  });

  it('has a route for every kind, each a POST core serves at the pin', () => {
    expect(Object.keys(RETRY_ROUTES)).toEqual([...RETRY_KINDS]);
    for (const kind of RETRY_KINDS) {
      const known = RETRY_ROUTES[kind];
      expect(known, kind).not.toBeNull();
      expect(known?.route.method, kind).toBe('POST');
      expect(SERVED.has(`${known?.route.method} ${known?.route.path}`), kind).toBe(true);
      expect(known?.route.path, kind).toContain(`{${known?.param}}`);
    }
  });
});

describe('statusLabel', () => {
  it("reads '<word>: <title>. <next step>.'", () => {
    expect(
      statusLabel('Needs you', 'Split the Airbnb', 'Allow me to send the message, or refuse'),
    ).toBe('Needs you: Split the Airbnb. Allow me to send the message, or refuse.');
  });

  it('never doubles the end of a sentence', () => {
    expect(statusLabel('Needs you', 'Which tone?', 'Pick one.')).toBe(
      'Needs you: Which tone? Pick one.',
    );
    expect(statusLabel('Working', 'Draft', 'Nearly there!')).toBe('Working: Draft. Nearly there!');
  });

  it('says the word alone for a row without a title', () => {
    expect(statusLabel('Done', '   ', null)).toBe('Done.');
  });
});

describe('stateMark', () => {
  it("draws the vocabulary's word in the state's role outside HUD", () => {
    expect(stateMark('ready', false, 'light')).toEqual({
      glyph: '✓',
      word: 'Ready to look at',
      glyphToken: 'success',
      wordToken: 'mutedForeground',
    });
    expect(stateMark('needs_you', false, 'light')).toMatchObject({
      glyph: '◆',
      glyphToken: 'warnInk',
      wordToken: 'warnInk',
    });
    expect(stateMark('needs_you', false, 'dark').glyphToken).toBe('warning');
  });

  it("draws HUD's word in its glyph's role", () => {
    expect(stateMark('failed', true, 'dark')).toEqual({
      glyph: '✕',
      word: 'Failed',
      glyphToken: 'destructive',
      wordToken: 'mutedForeground',
    });
    expect(stateMark('ready', true, 'dark')).toMatchObject({
      word: 'Ready',
      glyphToken: 'primary',
    });
    expect(stateMark('done', true, 'dark').glyphToken).toBe('mutedForeground');
  });
});

describe('the Try again call', () => {
  function clientAnswering(status: number, body: unknown) {
    const transport = fakeTransport(() => jsonReply(status, body));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'token',
      getWorkspaceId: () => null,
      transport,
    });
    return { client, transport };
  }

  it('sends one POST with no body to the chosen route', async () => {
    const { client, transport } = clientAnswering(200, { message: 'Ticket #0419 runs again.' });
    const action = retryAction({ kind: 'retry_ticket' }, BOTH);
    if (!action) throw new Error('expected a retry');
    const result = await sendRetry(client, action);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      method: 'POST',
      url: `${SERVER.apiUrl}/api/v1/tasks/2680/run-now`,
    });
    expect(transport.calls[0]?.body).toBeUndefined();
    expect(retriedMessage(result, action.kind)).toBe('Ticket #0419 runs again.');
  });

  it("says what was started when the server's answer has no words (a Mission's)", async () => {
    const { client, transport } = clientAnswering(200, { id: MISSION, state: 'running' });
    const action = retryAction({ kind: 'rerun_mission' }, BOTH);
    if (!action) throw new Error('expected a retry');
    const result = await sendRetry(client, action);
    expect(transport.calls[0]?.url).toBe(`${SERVER.apiUrl}/api/missions/${MISSION}/resume`);
    expect(retriedMessage(result, 'rerun_mission')).toBe(STATUS_ROW_COPY.retried.rerun_mission);
    for (const kind of RETRY_KINDS) {
      expect(retriedMessage(undefined, kind)).toBe(STATUS_ROW_COPY.retried[kind]);
      expect(STATUS_ROW_COPY.tryAgainHint[kind].trim()).not.toBe('');
    }
  });

  it('reads blank or odd words as none', () => {
    expect(RetryResultSchema.parse({ message: '  ' }).message).toBeNull();
    expect(RetryResultSchema.parse({ message: 7 }).message).toBeNull();
    expect(RetryResultSchema.parse({}).message).toBeUndefined();
  });

  it("passes the server's refusal on as an ApiError", async () => {
    const { client } = clientAnswering(409, { detail: 'Ticket #0419 is already running.' });
    const action = retryAction({ kind: 'retry_ticket' }, BOTH);
    if (!action) throw new Error('expected a retry');
    await expect(sendRetry(client, action)).rejects.toBeInstanceOf(ApiError);
  });
});
