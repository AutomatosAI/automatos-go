import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { jsonReply, reply, type FakeTransport } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { ROLE_COPY } from '../../auth/strings';
import {
  MISSION_GOAL_MAX_CHARS,
  REJECT_REASON_MAX_CHARS,
  approveBody,
  canAct,
  cardAccess,
  isUserSentence,
  missionCreateBody,
  planRefusalText,
  refusalText,
  rejectBody,
  rejectReasonError,
  type ContextMessage,
} from '../cards/actions';
import { approveMission, createMission, rejectMission } from '../cards/api';
import { CARD_COPY } from '../strings';
import { API, CHAT_ID, callsTo, clientWith, routedTransport } from './thread-fixtures';

const MISSION_ID = '5b0e4c1d-0000-4000-8000-0000000000a1';
const RUN = { id: MISSION_ID, goal: 'Launch the spring campaign', state: 'planning', plan: {} };

const said = (count: number): ContextMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message ${index + 1}`,
  }));

function sentBody(transport: FakeTransport, path: string): unknown {
  const [call] = callsTo(transport, 'POST', path);
  if (!call) throw new Error(`nothing was sent to ${path}`);
  return typeof call.body === 'string' ? JSON.parse(call.body) : call.body;
}

function refusal(status: number, detail: unknown): ApiError {
  const kind = status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'server';
  const body = typeof detail === 'string' ? detail : JSON.stringify(detail);
  return new ApiError(kind, { status, serverMessage: body });
}

describe('File it: the Mission suggestion payload (mission-suggestion-card.tsx)', () => {
  it('sends the goal, source chat, the chat id and the last five messages', () => {
    expect(missionCreateBody('  Launch the spring campaign ', CHAT_ID, said(3))).toEqual({
      goal: 'Launch the spring campaign',
      config: { source: 'chat', chat_id: CHAT_ID, context_messages: said(3) },
    });
  });

  it('caps context_messages at the newest five', () => {
    const body = missionCreateBody('Goal', CHAT_ID, said(9));
    expect(body.config.context_messages).toHaveLength(5);
    expect(body.config.context_messages).toEqual(said(9).slice(-5));
  });

  it('leaves out an empty context and a draft has no chat id (the web omits both)', () => {
    expect(missionCreateBody('Goal', null, [])).toEqual({
      goal: 'Goal',
      config: { source: 'chat' },
    });
  });

  it('clips a goal to what MissionCreateRequest takes', () => {
    const body = missionCreateBody('g'.repeat(MISSION_GOAL_MAX_CHARS + 50), CHAT_ID, []);
    expect(body.goal).toHaveLength(MISSION_GOAL_MAX_CHARS);
  });

  it('POSTs /api/missions through the client and reads the run back', async () => {
    const transport = routedTransport({ 'POST /api/missions': () => jsonReply(201, RUN) });
    const body = missionCreateBody('Launch the spring campaign', CHAT_ID, said(7));
    const run = await createMission(clientWith(transport), body);
    expect(run).toEqual({ id: MISSION_ID, goal: 'Launch the spring campaign', state: 'planning' });
    expect(sentBody(transport, '/api/missions')).toEqual(JSON.parse(JSON.stringify(body)));
    expect(transport.calls[0]?.url).toBe(`${API}/api/missions`);
  });
});

describe('the plan approval payloads (MissionApprovalWidget)', () => {
  it('Approve sends an empty body: MissionApproveRequest forbids anything else', async () => {
    expect(approveBody()).toEqual({});
    expect(Object.keys(approveBody())).toHaveLength(0);
    const path = `/api/missions/${MISSION_ID}/approve`;
    const transport = routedTransport({ [`POST ${path}`]: () => jsonReply(200, RUN) });
    await approveMission(clientWith(transport), MISSION_ID);
    expect(sentBody(transport, path)).toEqual({});
  });

  it('Reject sends the trimmed reason', async () => {
    const body = rejectBody('  Too many steps for a first pass. ');
    expect(body).toEqual({ reason: 'Too many steps for a first pass.' });
    const path = `/api/missions/${MISSION_ID}/reject`;
    const transport = routedTransport({ [`POST ${path}`]: () => jsonReply(200, RUN) });
    await rejectMission(clientWith(transport), MISSION_ID, body!);
    expect(sentBody(transport, path)).toEqual({ reason: 'Too many steps for a first pass.' });
  });

  it('refuses a reject without a reason client-side: no body, so nothing can be sent', () => {
    for (const blank of ['', '   ', '\n\t ']) {
      expect(rejectBody(blank)).toBeNull();
      expect(rejectReasonError(blank)).toBe(CARD_COPY.reasonRequired);
    }
    expect(rejectReasonError('Not now.')).toBeNull();
  });

  it('refuses a reason longer than MissionRejectRequest takes', () => {
    const long = 'r'.repeat(REJECT_REASON_MAX_CHARS + 1);
    expect(rejectBody(long)).toBeNull();
    expect(rejectReasonError(long)).toBe(CARD_COPY.reasonTooLong(REJECT_REASON_MAX_CHARS));
    expect(rejectBody('r'.repeat(REJECT_REASON_MAX_CHARS))).not.toBeNull();
  });
});

describe('who may act on a card (D16, D17)', () => {
  const writers: WorkspaceRole[] = ['owner', 'admin', 'editor'];

  it('owners, admins and editors act; a viewer and an unknown role do not', () => {
    for (const role of WORKSPACE_ROLES) {
      expect(canAct(role)).toBe(writers.includes(role));
      expect(canAct(role, 'chat')).toBe(writers.includes(role));
    }
    expect(canAct(null)).toBe(false);
    expect(canAct(undefined)).toBe(false);
  });

  it('a viewer reads the card with the D17 words, never a button', () => {
    expect(cardAccess('viewer')).toEqual({ canAct: false, note: ROLE_COPY.viewerReadOnly });
    expect(cardAccess('viewer', 'chat')).toEqual({ canAct: false, note: ROLE_COPY.viewerReadOnly });
    for (const role of writers) expect(cardAccess(role)).toEqual({ canAct: true, note: null });
  });
});

describe('a refused card action (403, 409, 422): words, never a status code', () => {
  it('shows the server’s sentence when a person wrote it', () => {
    const words = 'This plan was already approved by someone else.';
    expect(refusalText(refusal(409, words))).toBe(words);
    expect(refusalText(refusal(422, 'Plan validation failed: the goal is too vague.'))).toBe(
      'Plan validation failed: the goal is too vague.',
    );
  });

  it('falls back to the taxonomy for internals the server wrote for itself', () => {
    const cases: [number, string, string][] = [
      [403, 'Permission denied: missions:update', API_ERROR_COPY.forbidden],
      [403, 'Access denied: workspace mismatch', API_ERROR_COPY.forbidden],
      [
        409,
        `Optimistic lock conflict on run ${MISSION_ID} — another transaction modified this row`,
        API_ERROR_COPY.conflict,
      ],
      [
        409,
        `Invalid run transition: executing → approved (entity ${MISSION_ID})`,
        API_ERROR_COPY.conflict,
      ],
      [400, "Mission is in 'running' state, expected 'awaiting_approval'", API_ERROR_COPY.server],
      [422, '[{"loc": ["body", "reason"], "msg": "field required"}]', API_ERROR_COPY.server],
    ];
    for (const [status, detail, words] of cases) {
      expect(refusalText(refusal(status, detail))).toBe(words);
    }
  });

  it('never shows words that may name a plan, a price or credits (D-NO-BILLING)', () => {
    for (const detail of [
      'You have run out of credits.',
      'Upgrade to the Pro plan to run Missions.',
      'Your trial has ended.',
      'Missions cost $5 each.',
    ]) {
      expect(isUserSentence(detail)).toBe(false);
      expect(refusalText(refusal(403, detail))).toBe(API_ERROR_COPY.forbidden);
    }
  });

  it('never shows a status code or server words for other kinds', () => {
    const texts = [
      refusalText(new ApiError('network')),
      refusalText(new ApiError('not_found', { status: 404, serverMessage: 'Mission not found.' })),
      refusalText(new ApiError('server', { status: 500, serverMessage: 'Something broke.' })),
      refusalText(new TypeError('boom')),
    ];
    expect(texts).toEqual([
      API_ERROR_COPY.network,
      API_ERROR_COPY.not_found,
      API_ERROR_COPY.server,
      API_ERROR_COPY.server,
    ]);
    for (const text of texts) expect(text).not.toMatch(/\b\d{3}\b/);
  });

  it('reads a refusal off the wire through the client', async () => {
    const path = `/api/missions/${MISSION_ID}/approve`;
    const conflict = { detail: 'Someone else decided this plan a moment ago.' };
    const transport = routedTransport({ [`POST ${path}`]: () => jsonReply(409, conflict) });
    const caught = await approveMission(clientWith(transport), MISSION_ID).catch((e) => e);
    expect(refusalText(caught)).toBe('Someone else decided this plan a moment ago.');
    const plain = routedTransport({ [`POST ${path}`]: () => reply(403, 'Forbidden') });
    const denied = await approveMission(clientWith(plain), MISSION_ID).catch((e) => e);
    expect(refusalText(denied)).toBe(API_ERROR_COPY.forbidden);
  });
});

describe('a plan someone already decided says so (planRefusalText)', () => {
  /** api/missions.py approve_plan and reject_plan, for a Mission no longer awaiting approval. */
  const wrongState = (state: string) =>
    `Mission is in '${state}' state, expected 'awaiting_approval'`;

  it('names an approved, a rejected and any other decided plan by the state the server names', () => {
    expect(planRefusalText(refusal(400, wrongState('running')))).toBe(CARD_COPY.alreadyApproved);
    expect(planRefusalText(refusal(400, wrongState('cancelled')))).toBe(CARD_COPY.alreadyRejected);
    expect(planRefusalText(refusal(400, wrongState('pending')))).toBe(CARD_COPY.alreadyDecided);
    expect(CARD_COPY.alreadyApproved).toBe('This plan was already approved.');
    expect(CARD_COPY.alreadyRejected).toBe('This plan was already rejected or cancelled.');
    expect(CARD_COPY.alreadyDecided).toBe('This plan was already decided.');
  });

  it('reads every state an approve leads to as approved', () => {
    for (const state of [
      'running',
      'paused',
      'replanning',
      'verifying',
      'awaiting_human',
      'completed',
      'failed',
    ]) {
      expect(planRefusalText(refusal(400, wrongState(state)))).toBe(CARD_COPY.alreadyApproved);
    }
    expect(planRefusalText(refusal(400, wrongState('planning')))).toBe(CARD_COPY.alreadyDecided);
  });

  it('gives the same words on a 409, with an end stop and spaces around it', () => {
    expect(planRefusalText(refusal(409, wrongState('running')))).toBe(CARD_COPY.alreadyApproved);
    expect(planRefusalText(refusal(409, `  ${wrongState('cancelled')}. `))).toBe(
      CARD_COPY.alreadyRejected,
    );
  });

  it('keeps the taxonomy words for every other refusal', () => {
    const cases: [number, string, string][] = [
      [403, 'Permission denied: missions:update', API_ERROR_COPY.forbidden],
      [
        409,
        `Optimistic lock conflict on run ${MISSION_ID} — another transaction modified this row`,
        API_ERROR_COPY.conflict,
      ],
      [
        409,
        `Invalid run transition: running → cancelled (entity ${MISSION_ID})`,
        API_ERROR_COPY.conflict,
      ],
      [422, '[{"loc": ["body", "reason"], "msg": "field required"}]', API_ERROR_COPY.server],
      [422, wrongState('running'), API_ERROR_COPY.server],
      [
        400,
        "Mission is in 'RunState.RUNNING' state, expected 'awaiting_approval'",
        API_ERROR_COPY.server,
      ],
    ];
    for (const [status, detail, words] of cases) {
      expect(planRefusalText(refusal(status, detail))).toBe(words);
    }
    expect(planRefusalText(new ApiError('network'))).toBe(API_ERROR_COPY.network);
    expect(planRefusalText(new TypeError('boom'))).toBe(API_ERROR_COPY.server);
  });

  it('reads the wrong-state 400 off the wire through the client', async () => {
    const route = `POST /api/missions/${MISSION_ID}/approve`;
    const body = { detail: wrongState('running') };
    const transport = routedTransport({ [route]: () => jsonReply(400, body) });
    const caught = await approveMission(clientWith(transport), MISSION_ID).catch((e) => e);
    expect(planRefusalText(caught)).toBe(CARD_COPY.alreadyApproved);
    expect(refusalText(caught)).toBe(API_ERROR_COPY.server);
  });

  it('is what the plan card hands its request, as the grant card hands grantRefusalText', () => {
    const card = readFileSync(
      path.resolve(__dirname, '..', 'cards', 'PlanApprovalCard.tsx'),
      'utf8',
    );
    expect(card).toMatch(/useCardRequest\(card\.key, onSettled, planRefusalText\)/);
  });
});
