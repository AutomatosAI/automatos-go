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
import { createPushApprovals, viewFailureLine } from '../../approvals/push-sheet';
import { APPROVAL_ROUTES } from '../../approvals/routes';
import { APPROVAL_SHEET_COPY } from '../../approvals/strings';
import { jsonReply } from '../../api/__tests__/fake-transport';
import { routes } from '../../navigation/routes';
import { DEFAULT_ACTION_ID } from '../config';
import { handleResponse, type HandlerDeps } from '../inbound/handler';
import { intentFor } from '../inbound/intent';
import { parsePushData } from '../schemas/payload';
import { PUSH_LINK_COPY } from '../strings';
import { NOTIFICATION_ID, WS, harness } from './data-fixtures';
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

/** The handler's deps with a sheet port: offered or not, and what it was asked to open. */
function withSheet(offered: boolean, base = world()) {
  const opened: string[] = [];
  const deps: HandlerDeps = {
    ...base.deps,
    approvals: { offered: () => offered, open: (grantId) => void opened.push(grantId) },
  };
  return { ...base, deps, opened };
}

describe('the push names its approval', () => {
  const intentOf = (fields: Parameters<typeof signed>[0]) =>
    intentFor({
      event: { action: DEFAULT_ACTION_ID, userText: null },
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
    expect(sheets.current()).toEqual({ grantId: null, visible: false });
    sheets.open('77');
    sheets.open('78');
    expect(sheets.current()).toEqual({ grantId: '78', visible: true });
    sheets.close();
    expect(sheets.current()).toEqual({ grantId: '78', visible: false });
    sheets.close();
    expect(told).toHaveBeenCalledTimes(3);
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
