import { describe, expect, it } from 'vitest';

import { jsonReply, reply } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { ROLE_COPY } from '../../auth/strings';
import type { Frame } from '../../core/ai-sdk-stream';
import { WAITING_FOR_YOU } from '../../core/frozen/components/play/chat/labels';
import { approvalsInPart } from '../../core/web/lib/chat/approvals';
import { cardAccess, grantRefusalText } from '../cards/actions';
import {
  denyCall,
  grantCall,
  grantedLine,
  toolLine,
  withdrawAction,
  withdrawSettled,
} from '../cards/grants';
import { DENIED, KEPT, OPEN, WITHDRAWN, toolCardKey } from '../cards/model';
import type { CardRow, ToolApprovalRow, WithdrawRow } from '../cards/view';
import { paramRows } from '../cards/view-tools';
import type { ThreadState } from '../controller/thread';
import { GRANT_COPY } from '../strings';
import { threadRows } from '../view-model';
import { callsTo, clientWith, routedTransport, saved } from './thread-fixtures';
import { WEB, apply, autoRows, streaming } from './view-model-fixtures';

const GRANT_ID = 41;
const OTHER_GRANT = 42;
const GRANT_PATH = `/api/v1/approval-grants/${GRANT_ID}/grant`;
const DENY_PATH = `/api/v1/approval-grants/${GRANT_ID}/deny`;
const TOOL_DATA = {
  grant_id: GRANT_ID,
  action: 'platform_delete_task',
  message: 'Delete ticket #0425?',
  question_md: 'Delete #0425 · Cafe questions (Inbox → gone)',
  permission_level: 'destructive',
  params: { task_id: 2680, reason: 'duplicate', tags: ['cafe', 'q3'] },
  risk_tier: 'human_in_the_loop',
  risk_class: 'data_loss',
  oversight_rationale: 'Deleting a ticket cannot be undone.',
};
const TOOL_CARD: Frame = {
  kind: 'tool-data',
  approvals: approvalsInPart({ type: 'tool-data', data: { tool_approval: TOOL_DATA } }),
  deliverables: [],
};
const START: Frame = { kind: 'tool-start', toolCallId: 'call-1', toolName: 'platform_delete_task' };
const ended = (waiting: boolean): Frame => ({
  kind: 'tool-end',
  toolCallId: 'call-1',
  toolName: 'platform_delete_task',
  success: false,
  skipped: false,
  waiting,
});
const FINISH: Frame = { kind: 'finish', finishReason: 'stop', aiGenerated: true };
const OFFER: Frame = {
  kind: 'withdraw_offer',
  offer: {
    message: 'You said no while these still wait on a yes. Withdraw them?',
    requests: [
      { grant_id: GRANT_ID, action: 'platform_delete_task', reason: 'Delete #0425' },
      { grant_id: OTHER_GRANT, action: 'platform_send_email', reason: null },
    ],
  },
};
const granted = (executed: unknown) => ({
  grant: { id: GRANT_ID, status: 'granted', details: { executed_result: executed } },
});

function grantTransport(executed: unknown = { success: true }) {
  return routedTransport({
    [`POST ${GRANT_PATH}`]: () => jsonReply(200, granted(executed)),
    [`POST ${DENY_PATH}`]: () => jsonReply(200, { grant: { id: GRANT_ID, status: 'denied' } }),
  });
}

const rowsOf = (state: ThreadState) => autoRows(threadRows(state, { webUrl: WEB }));
const cardsOf = (state: ThreadState): CardRow[] => rowsOf(state).flatMap((row) => row.cards);
const toolOf = (state: ThreadState) =>
  cardsOf(state).find((card): card is ToolApprovalRow => card.kind === 'tool');
const offerOf = (state: ThreadState) =>
  cardsOf(state).find((card): card is WithdrawRow => card.kind === 'withdraw');

function refusal(status: number, detail: string): ApiError {
  const kind = status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'server';
  return new ApiError(kind, { status, serverMessage: detail });
}

describe('Approve & run and Deny: the grant payloads (ToolApprovalWidget)', () => {
  it('Approve & run POSTs …/grant with no body and keeps what the click ran', async () => {
    const transport = grantTransport({ success: true, resumed_via: 'tool_call', extra: 1 });
    const outcome = await grantCall(GRANT_ID)(clientWith(transport));
    const [call] = callsTo(transport, 'POST', GRANT_PATH);
    expect(call?.body).toBeUndefined();
    expect(call?.headers['Content-Type']).toBeUndefined();
    expect(outcome).toEqual({ state: 'granted', run: { success: true, resumed_via: 'tool_call' } });
  });

  it('a grant that carries no executed result settles granted with no run', async () => {
    const transport = routedTransport({
      [`POST ${GRANT_PATH}`]: () => jsonReply(200, { grant: { id: GRANT_ID, status: 'granted' } }),
    });
    expect(await grantCall(GRANT_ID)(clientWith(transport))).toEqual({
      state: 'granted',
      run: null,
    });
  });

  it('Deny POSTs …/deny with no body and settles denied', async () => {
    const transport = grantTransport();
    expect(await denyCall(GRANT_ID)(clientWith(transport))).toBe(DENIED);
    const [call] = callsTo(transport, 'POST', DENY_PATH);
    expect(call?.body).toBeUndefined();
    expect(callsTo(transport, 'POST', GRANT_PATH)).toHaveLength(0);
  });
});

describe('what the approved line says: what the click ran, never a success it did not have', () => {
  it('names a run, a re-queue, an ask again and no result', () => {
    expect(grantedLine({ success: true })).toEqual({
      mark: '✓',
      tone: 'done',
      text: GRANT_COPY.ran,
    });
    expect(grantedLine({ resumed_via: 'board_task_requeue' }).text).toBe(GRANT_COPY.requeued);
    expect(grantedLine({ requires_confirmation: true })).toMatchObject({
      tone: 'waiting',
      text: GRANT_COPY.askedAgain,
    });
    expect(grantedLine(null)).toMatchObject({ tone: 'done', text: GRANT_COPY.approved });
  });

  it('a resumed call that failed is drawn failed, with its reason only when a person wrote it', () => {
    expect(grantedLine({ success: false, error: 'The recipient address bounced.' })).toEqual({
      mark: '✕',
      tone: 'failed',
      text: GRANT_COPY.failedBecause('The recipient address bounced.'),
    });
    for (const error of ["KeyError: 'task_id'", 'You have run out of credits.', null]) {
      expect(grantedLine({ success: false, error }).text).toBe(GRANT_COPY.failed);
    }
  });

  it('denied and withdrawn read as the action not running', () => {
    expect(toolLine(DENIED)).toMatchObject({ tone: 'muted', text: GRANT_COPY.denied });
    expect(toolLine(WITHDRAWN).text).toBe(GRANT_COPY.denied);
  });
});

describe('waiting is drawn as waiting, never as failed (P256-FIX-RVW-22)', () => {
  it("a tool-end 'waiting' frame leaves the line and the card waiting for you", () => {
    const state = apply(streaming(START, TOOL_CARD, ended(true), FINISH), { type: 'finished' });
    const [line] = rowsOf(state).flatMap((row) => row.toolLines);
    expect(line?.tone).toBe('waiting');
    expect(line?.accessibilityLabel).toContain(WAITING_FOR_YOU);
    const card = toolOf(state);
    expect(card?.line).toEqual({ mark: '…', tone: 'waiting', text: GRANT_COPY.waiting });
    expect(card?.decided).toBe(false);
  });

  it('the same frame without waiting is a failure (the contrast)', () => {
    const state = apply(streaming(START, ended(false), FINISH), { type: 'finished' });
    expect(rowsOf(state).flatMap((row) => row.toolLines)[0]?.tone).toBe('failed');
  });

  it('reads the card as the web does: the question, the call, its level, oversight, params', () => {
    const card = toolOf(streaming(TOOL_CARD));
    expect(card).toMatchObject({
      key: toolCardKey(GRANT_ID),
      grantId: GRANT_ID,
      action: 'platform_delete_task',
      question: TOOL_DATA.question_md,
      permission: 'destructive',
      oversight: {
        title: 'Human approval required · data loss',
        rationale: 'Deleting a ticket cannot be undone.',
      },
      outcome: OPEN,
    });
    expect(card?.params).toEqual([
      { key: 'task_id', value: '2680' },
      { key: 'reason', value: 'duplicate' },
      { key: 'tags', value: '["cafe","q3"]' },
    ]);
  });

  it('falls back to the message, then to the call alone, and clips a long value to one line', () => {
    const plain = approvalsInPart({
      type: 'tool-data',
      data: { tool_approval: { grant_id: OTHER_GRANT, action: '', message: 'Send it?' } },
    });
    const card = toolOf(streaming({ kind: 'tool-data', approvals: plain, deliverables: [] }));
    expect(card).toMatchObject({ action: 'platform_action', question: 'Send it?', params: [] });
    const [long] = paramRows({ body: `${'word '.repeat(80)}\nend`, none: null });
    expect(long?.value.length).toBeLessThanOrEqual(200);
    expect(long?.value).not.toContain('\n');
    expect(paramRows({ none: null })).toEqual([{ key: 'none', value: 'null' }]);
  });

  it('a granted card keeps what ran when its reply is saved', () => {
    const live = streaming(TOOL_CARD, FINISH);
    const outcome = { state: 'granted', run: { success: true } } as const;
    const decided = apply(
      live,
      { type: 'card', key: toolCardKey(GRANT_ID), outcome },
      { type: 'finished' },
      {
        type: 'refetched',
        messages: [saved('m-asked', 'user', 'Status?'), saved('m-replied', 'assistant', 'Ok.')],
      },
    );
    expect(toolOf(decided)).toMatchObject({ decided: true, line: { text: GRANT_COPY.ran } });
  });
});

describe('the withdraw offer: Withdraw denies the grant, Keep it sends nothing', () => {
  it('Withdraw POSTs …/deny with no body and settles withdrawn', async () => {
    const transport = grantTransport();
    const action = withdrawAction('withdraw', GRANT_ID);
    if (action.kind !== 'call') throw new Error('Withdraw must call the server');
    expect(await action.call(clientWith(transport))).toBe(WITHDRAWN);
    expect(callsTo(transport, 'POST', DENY_PATH)).toHaveLength(1);
    expect(callsTo(transport, 'POST', DENY_PATH)[0]?.body).toBeUndefined();
  });

  it('Keep it settles kept with no call at all', () => {
    expect(withdrawAction('keep', GRANT_ID)).toEqual({ kind: 'settle', outcome: KEPT });
    expect(withdrawSettled(KEPT)).toBe(GRANT_COPY.kept);
    expect(withdrawSettled(WITHDRAWN)).toBe(GRANT_COPY.withdrawn);
    expect(withdrawSettled(OPEN)).toBeNull();
  });

  it("draws an offer's requests as one card, each settled on its own", () => {
    const state = streaming(OFFER);
    const offer = offerOf(state);
    expect(cardsOf(state).filter((card) => card.kind === 'withdraw')).toHaveLength(1);
    expect(offer?.message).toBe(OFFER.kind === 'withdraw_offer' ? OFFER.offer.message : '');
    expect(offer?.requests.map((request) => [request.grantId, request.label])).toEqual([
      [GRANT_ID, 'Delete #0425'],
      [OTHER_GRANT, 'platform_send_email'],
    ]);
    const [first, second] = offer?.requests ?? [];
    const kept = apply(state, { type: 'card', key: second!.key, outcome: KEPT });
    expect(offerOf(kept)?.requests.map((request) => request.settled)).toEqual([
      null,
      GRANT_COPY.kept,
    ]);
    const both = apply(kept, { type: 'card', key: first!.key, outcome: WITHDRAWN });
    expect(offerOf(both)?.requests.map((request) => request.settled)).toEqual([
      GRANT_COPY.withdrawn,
      GRANT_COPY.kept,
    ]);
  });

  it('a request with neither a reason nor an action is named by its request number', () => {
    const offer: Frame = {
      kind: 'withdraw_offer',
      offer: { message: 'Withdraw?', requests: [{ grant_id: 7 }] },
    };
    expect(offerOf(streaming(offer))?.requests[0]?.label).toBe(GRANT_COPY.request(7));
  });

  it("withdrawing a request denies the same grant's tool card, and denying withdraws it", () => {
    const state = streaming(TOOL_CARD, OFFER);
    const request = offerOf(state)!.requests[0]!;
    const withdrawn = apply(state, { type: 'card', key: request.key, outcome: WITHDRAWN });
    expect(toolOf(withdrawn)).toMatchObject({ decided: true, outcome: DENIED });
    expect(offerOf(withdrawn)?.requests[1]?.settled).toBeNull();
    const denied = apply(state, { type: 'card', key: toolCardKey(GRANT_ID), outcome: DENIED });
    expect(offerOf(denied)?.requests[0]?.settled).toBe(GRANT_COPY.withdrawn);
  });
});

describe('who may act on a grant card (D16, D17): a viewer reads it, never a button', () => {
  const writers: WorkspaceRole[] = ['owner', 'admin', 'editor'];

  it('owners, admins and editors may approve, deny and withdraw; a viewer and no role may not', () => {
    for (const role of WORKSPACE_ROLES) {
      expect(cardAccess(role, 'approve').canAct).toBe(writers.includes(role));
    }
    expect(cardAccess(null, 'approve').canAct).toBe(false);
  });

  it('a viewer gets the D17 words in place of the open card’s buttons', () => {
    expect(cardAccess('viewer', 'approve')).toEqual({
      canAct: false,
      note: ROLE_COPY.viewerReadOnly,
    });
    const card = toolOf(streaming(TOOL_CARD));
    expect(card?.decided).toBe(false);
    expect(offerOf(streaming(OFFER))?.requests.every((request) => request.settled === null)).toBe(
      true,
    );
  });

  it('an editor refused before PRD-266 W1 reads the taxonomy, never the server words', async () => {
    const transport = routedTransport({
      [`POST ${GRANT_PATH}`]: () => jsonReply(403, { detail: 'Workspace admin only' }),
    });
    const caught = await grantCall(GRANT_ID)(clientWith(transport)).catch((error) => error);
    expect(grantRefusalText(caught)).toBe(API_ERROR_COPY.forbidden);
  });
});

describe("a refused click: the server's honest words, or ours (api/approval_grants.py)", () => {
  it('a decided card says what it was decided as', () => {
    const cases: [string, string][] = [
      ['Grant is not pending (status: granted)', GRANT_COPY.alreadyDecided.granted],
      ['Grant is not pending (status: denied)', GRANT_COPY.alreadyDecided.denied],
      ['Grant is not pending (status: expired)', GRANT_COPY.alreadyDecided.expired],
      ['Grant is not pending (status: revoked)', GRANT_COPY.alreadyDecided.revoked],
      ['Grant is not pending (status: answered)', GRANT_COPY.alreadyAnswered],
      ['Grant is not pending (status: constructor)', GRANT_COPY.alreadyAnswered],
    ];
    for (const [detail, words] of cases) {
      expect(grantRefusalText(refusal(422, detail))).toBe(words);
      expect(grantRefusalText(refusal(409, detail))).toBe(words);
    }
  });

  it("a 409 or 422 'already answered' a person wrote is shown as the server said it", () => {
    for (const detail of [
      'This approval was already decided (status: granted); nothing ran again.',
      'This card expired at 05:12 on 15 Oct; nothing ran. Ask Auto again for a fresh card.',
      'Grant is not pending: it was replaced by a newer card for the same request; nothing ran. Approve the newer card.',
      'Someone already answered this request.',
    ]) {
      expect(grantRefusalText(refusal(422, detail))).toBe(detail);
      expect(grantRefusalText(refusal(409, detail))).toBe(detail);
    }
  });

  it('internals, money and other kinds fall back to the taxonomy', () => {
    const routed =
      'Grant 41 is a question, not an approval — answer it: POST /api/v1/approval-grants/41/answer with {"answer_text": "<your answer>"}.';
    expect(grantRefusalText(refusal(422, routed))).toBe(API_ERROR_COPY.server);
    expect(grantRefusalText(refusal(409, 'Upgrade to the Pro plan to approve.'))).toBe(
      API_ERROR_COPY.conflict,
    );
    expect(
      grantRefusalText(new ApiError('not_found', { status: 404, serverMessage: 'Gone.' })),
    ).toBe(API_ERROR_COPY.not_found);
    expect(grantRefusalText(new ApiError('network'))).toBe(API_ERROR_COPY.network);
    expect(grantRefusalText(new TypeError('boom'))).toBe(API_ERROR_COPY.server);
  });

  it('reads the refusal off the wire through the client', async () => {
    const transport = routedTransport({
      [`POST ${DENY_PATH}`]: () =>
        jsonReply(422, { detail: 'Grant is not pending (status: granted)' }),
    });
    const caught = await denyCall(GRANT_ID)(clientWith(transport)).catch((error) => error);
    expect(grantRefusalText(caught)).toBe(GRANT_COPY.alreadyDecided.granted);
    const plain = routedTransport({ [`POST ${DENY_PATH}`]: () => reply(422, 'Unprocessable') });
    const bare = await denyCall(GRANT_ID)(clientWith(plain)).catch((error) => error);
    expect(grantRefusalText(bare)).toBe(API_ERROR_COPY.server);
  });
});
