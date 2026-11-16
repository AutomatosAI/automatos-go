// The approval sheet from push (PRD-268 US-G08, §6.12.5 'the card or the push opens a bottom
// sheet'): a verified tap on an approval's push names its signed grant_id; where the caller offers
// the sheet (discovery lists approval_view, core W3's US-C24, and the role may approve) the tap opens
// the chat as before and the sheet over it; elsewhere, or for a decided approval, a question or an
// unverified push, exactly what it opened before. The sheet reads the grant's ApprovalView@1.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { canApprovalView } from '../../api/capabilities';
import { ApiError } from '../../api/errors';
import { fetchApprovalView } from '../../approvals/api';
import { VIEW } from '../../approvals/__tests__/fixtures';
import {
  createPushApprovals,
  decidedPlan,
  settledLine,
  viewFailureLine,
} from '../../approvals/push-sheet';
import { APPROVAL_ROUTES } from '../../approvals/routes';
import { APPROVAL_SHEET_COPY } from '../../approvals/strings';
import { CARD_COPY } from '../../chat/strings';
import { jsonReply } from '../../api/__tests__/fake-transport';
import { routes } from '../../navigation/routes';
import { DEFAULT_ACTION_ID } from '../config';
import { handleResponse, type HandlerDeps } from '../inbound/handler';
import { intentFor } from '../inbound/intent';
import { parsePushData } from '../schemas/payload';
import { inboxRoute } from '../nav';
import { PUSH_LINK_COPY } from '../strings';
import { NOTIFICATION_ID, POST_ID, WS, harness } from './data-fixtures';
import {
  CARD_CHAT_ID,
  NOW_S,
  OTHER_KEY,
  QUESTION_FIELDS,
  response,
  signed,
  world,
} from './handler-fixtures';

const APPROVAL_FIELDS = Object.freeze({
  v: 2,
  type: 'needs_answer',
  workspace_id: WS,
  notification_id: NOTIFICATION_ID,
  grant_id: '77',
  link_type: 'approval_grant',
  link_id: '77',
  iat: NOW_S,
});

const tap = (data: unknown) => response(data, DEFAULT_ACTION_ID);

/** The handler's deps with a sheet port: offered or not, and what it was asked to open (and as what). */
function withSheet(offered: boolean, base = world()) {
  const opened: string[] = [];
  const kinds: string[] = [];
  const deps: HandlerDeps = {
    ...base.deps,
    approvals: {
      offered: () => offered,
      open: (grantId, kind = 'tool') => {
        opened.push(grantId);
        kinds.push(kind);
      },
    },
  };
  return { ...base, deps, opened, kinds };
}

/** A Mission plan's push (mission_plan_ready): its link names the Mission; it carries no grant. */
const MISSION_FIELDS = Object.freeze({
  v: 2,
  type: 'needs_answer',
  workspace_id: WS,
  notification_id: NOTIFICATION_ID,
  link_type: 'mission',
  link_id: POST_ID,
  iat: NOW_S,
});

describe('the push names its approval', () => {
  const intentOf = (fields: Parameters<typeof signed>[0]) =>
    intentFor({
      event: { action: DEFAULT_ACTION_ID, userText: null, body: null },
      verified: true,
      payload: parsePushData(signed(fields)),
      currentWorkspaceId: WS,
      role: 'editor',
    });

  it("a tap carries the approval's signed grant_id", () => {
    expect(intentOf(APPROVAL_FIELDS)).toMatchObject({ kind: 'open', grantId: '77' });
  });

  it("carries none for a question's grant, a grant that is not a row id, or none sent", () => {
    expect(intentOf(QUESTION_FIELDS)).toMatchObject({ kind: 'open' });
    expect(intentOf(QUESTION_FIELDS)).not.toHaveProperty('grantId');
    expect(intentOf({ ...APPROVAL_FIELDS, grant_id: '7x' })).not.toHaveProperty('grantId');
    const { grant_id: _decided, ...noGrant } = APPROVAL_FIELDS;
    expect(intentOf(noGrant)).toMatchObject({
      kind: 'open',
      link: { link_type: 'approval_grant' },
    });
    expect(intentOf(noGrant)).not.toHaveProperty('grantId');
  });
});

describe('a verified tap on an approval', () => {
  it('opens the chat its card is in, as before, and the sheet over it where it is offered', async () => {
    const run = withSheet(true);
    const outcome = await handleResponse(tap(signed(APPROVAL_FIELDS)), run.deps);
    expect(outcome).toEqual({ route: routes.chat(CARD_CHAT_ID) });
    expect(run.seen.routes).toEqual([routes.chat(CARD_CHAT_ID)]);
    expect(run.opened).toEqual(['77']);
  });

  it('opens exactly what it opened before where the server lists no approval_view', async () => {
    const run = withSheet(false);
    const outcome = await handleResponse(tap(signed(APPROVAL_FIELDS)), run.deps);
    expect(outcome).toEqual({ route: routes.chat(CARD_CHAT_ID) });
    expect(run.opened).toEqual([]);
  });

  it('opens no sheet for an approval already decided: the inbox says so', async () => {
    const run = withSheet(true, world({ checks: { grantPlaces: async () => [] } }));
    const outcome = await handleResponse(tap(signed(APPROVAL_FIELDS)), run.deps);
    expect(outcome?.toast).toBe(PUSH_LINK_COPY.approvalGone);
    expect(run.opened).toEqual([]);
  });

  it('opens no sheet for an unverified push, or a question', async () => {
    const forged = withSheet(true);
    await handleResponse(tap(signed(APPROVAL_FIELDS, OTHER_KEY)), forged.deps);
    expect(forged.opened).toEqual([]);
    const question = withSheet(true);
    await handleResponse(tap(signed(QUESTION_FIELDS)), question.deps);
    expect(question.opened).toEqual([]);
  });

  it('still opens the screen when the sheet cannot be opened', async () => {
    const run = world();
    const deps: HandlerDeps = {
      ...run.deps,
      approvals: {
        offered: () => true,
        open: () => {
          throw new Error('no sheet');
        },
      },
    };
    expect(await handleResponse(tap(signed(APPROVAL_FIELDS)), deps)).toEqual({
      route: routes.chat(CARD_CHAT_ID),
    });
  });
});

describe('a verified tap on a held board task, or a Mission plan', () => {
  it("opens a board task's approval on its ticket (the grant's subject), with the sheet over it", async () => {
    const held = { id: 77, details: null, subject_type: 'board_task', subject_id: '17' };
    const run = withSheet(true, world({ checks: { grantPlaces: async () => [held] } }));
    const outcome = await handleResponse(tap(signed(APPROVAL_FIELDS)), run.deps);
    expect(outcome).toEqual({ route: routes.cc.ticket('17') });
    expect(run.opened).toEqual(['77']);
  });

  it("opens a Mission plan awaiting approval with no chat in its plan's sheet over the inbox, never Studio", async () => {
    const waiting = async (id: string) => ({ id, state: 'awaiting_approval', config: null });
    const noChat = world({ checks: { missionPlace: waiting } });
    const run = withSheet(true, noChat);
    const outcome = await handleResponse(tap(signed(MISSION_FIELDS)), run.deps);
    expect(outcome).toEqual({ route: inboxRoute(NOTIFICATION_ID) });
    expect(run.opened).toEqual([POST_ID]);
    expect(run.kinds).toEqual(['plan']);
  });

  it('opens a Mission plan in the chat it was launched from, where its card is, with no sheet', async () => {
    const run = withSheet(true);
    const outcome = await handleResponse(tap(signed(MISSION_FIELDS)), run.deps);
    expect(outcome).toEqual({ route: routes.chat(CARD_CHAT_ID) });
    expect(run.opened).toEqual([]);
  });

  it('opens a Mission that has moved on (running, done) on the Board, with no sheet to answer', async () => {
    for (const state of ['running', 'completed', 'failed']) {
      const moved = async (id: string) => ({ id, state, config: null });
      const run = withSheet(true, world({ checks: { missionPlace: moved } }));
      const outcome = await handleResponse(tap(signed(MISSION_FIELDS)), run.deps);
      expect(outcome).toEqual({ route: routes.cc.board });
      expect(run.opened).toEqual([]);
    }
  });

  it('opens no plan sheet for a Mission that is gone, one whose state is unknown, or where the sheet is not offered', async () => {
    const missing = () => Promise.reject(new ApiError('not_found', { status: 404 }));
    const gone = withSheet(true, world({ checks: { missionPlace: missing } }));
    await handleResponse(tap(signed(MISSION_FIELDS)), gone.deps);
    expect(gone.opened).toEqual([]);
    const unknown = world({ checks: { missionPlace: async (id) => ({ id, config: null }) } });
    const noState = withSheet(true, unknown);
    expect(await handleResponse(tap(signed(MISSION_FIELDS)), noState.deps)).toEqual({
      route: inboxRoute(NOTIFICATION_ID),
    });
    expect(noState.opened).toEqual([]);
    const waiting = async (id: string) => ({ id, state: 'awaiting_approval', config: null });
    const off = withSheet(false, world({ checks: { missionPlace: waiting } }));
    await handleResponse(tap(signed(MISSION_FIELDS)), off.deps);
    expect(off.opened).toEqual([]);
  });
});

describe('the sheet', () => {
  it("reads the grant's ApprovalView@1 from core's view route, in the pinned manifest", async () => {
    const api = harness(() => jsonReply(200, { ...VIEW, grant_id: 77 }));
    const view = await fetchApprovalView(api.client, '77');
    expect(view.rule.sentence).toBe(VIEW.rule.sentence);
    expect(new URL(api.calls[0]?.url ?? '').pathname).toBe('/api/v1/approval-grants/77/view');
    expect(APPROVAL_ROUTES.view).toEqual({
      method: 'GET',
      path: '/api/v1/approval-grants/{grant_id}/view',
    });
    const manifest = readFileSync(
      path.resolve(__dirname, '../../core/route-manifest.json'),
      'utf8',
    );
    expect(manifest).toContain('"/api/v1/approval-grants/{grant_id}/view"');
  });

  it('refuses a view that names another grant', async () => {
    const api = harness(() => jsonReply(200, VIEW));
    await expect(fetchApprovalView(api.client, '77')).rejects.toBeInstanceOf(ApiError);
  });

  it('says one line when the view cannot be read: decided or lapsed, or anything else', () => {
    expect(viewFailureLine(new ApiError('not_found', { status: 404 }))).toBe(
      APPROVAL_SHEET_COPY.pushGone,
    );
    expect(viewFailureLine(new ApiError('network'))).toBe(APPROVAL_SHEET_COPY.pushUnreadable);
  });

  it('one sheet at a time: a newer tap replaces it; closing keeps it while it slides away', () => {
    const sheets = createPushApprovals();
    const told = vi.fn();
    sheets.subscribe(told);
    expect(sheets.current()).toEqual({ grantId: null, kind: 'tool', visible: false });
    sheets.open('77');
    sheets.open('78');
    expect(sheets.current()).toEqual({ grantId: '78', kind: 'tool', visible: true });
    sheets.close();
    expect(sheets.current()).toEqual({ grantId: '78', kind: 'tool', visible: false });
    sheets.close();
    expect(told).toHaveBeenCalledTimes(3);
  });

  it("opens a Mission plan's sheet as a plan, and says the plan card's words once answered", () => {
    const sheets = createPushApprovals();
    sheets.open('77');
    sheets.open(POST_ID, 'plan');
    expect(sheets.current()).toEqual({ grantId: POST_ID, kind: 'plan', visible: true });
    expect(settledLine('plan', { state: 'approved' })).toBe(CARD_COPY.approved);
    expect(settledLine('plan', { state: 'rejected' })).toBe(CARD_COPY.rejected);
    expect(settledLine('tool', { state: 'denied' })).not.toBe(CARD_COPY.rejected);
  });

  it("closes a Mission plan's sheet that offers no answers: the plan stopped waiting", () => {
    expect(decidedPlan('plan', { answers: [] })).toBe(true);
    expect(decidedPlan('plan', { answers: ['allow_once', 'refuse'] })).toBe(false);
    expect(decidedPlan('plan', undefined)).toBe(false);
    expect(decidedPlan('tool', { answers: [] })).toBe(false);
  });

  it('is offered by PushRoot only with approval_view and a role that may approve', () => {
    expect(canApprovalView({ capabilities: ['approval_view'], push: { expo: true } })).toBe(true);
    expect(canApprovalView({ capabilities: [], push: { expo: true } })).toBe(false);
    const root = readFileSync(path.resolve(__dirname, '../PushRoot.tsx'), 'utf8');
    expect(root).toMatch(/canApprovalView\(discovery\) && roleCan\(workspace\.role, 'approve'\)/);
    expect(root).toMatch(/<PushApprovalSheet \/>/);
    expect(root).toMatch(/approvals,\n/);
  });
});
