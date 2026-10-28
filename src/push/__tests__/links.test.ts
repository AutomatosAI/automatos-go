import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import { hangUntilAborted, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { logger } from '../../lib/logger';
import { routes } from '../../navigation/routes';
import { STALE_CHECK_TIMEOUT_MS } from '../config';
import { resolveTarget, staleChecksFor, type StaleChecks } from '../links/stale';
import { HOME_TARGET, routeFor, targetFor, type LinkTarget } from '../links/targets';
import { parsePushData } from '../schemas/payload';
import { PUSH_LINK_COPY } from '../strings';
import { FULL, POST_ID, harness, sent } from './data-fixtures';

const GRANT_ID = '42';
const TASK_ID = '17';
const CHAT_ID = '6c1d8e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f';

const link = (link_type?: string, link_id?: string) => ({
  ...(link_type === undefined ? {} : { link_type }),
  ...(link_id === undefined ? {} : { link_id }),
});

const QUESTION: LinkTarget = { kind: 'question', id: GRANT_ID };
const TICKET: LinkTarget = { kind: 'ticket', id: TASK_ID };
const SOCIAL: LinkTarget = { kind: 'social', id: POST_ID };
const CHAT: LinkTarget = { kind: 'chat', id: CHAT_ID };

const failing = (kind: ConstructorParameters<typeof ApiError>[0], status?: number) => () =>
  Promise.reject(new ApiError(kind, status === undefined ? {} : { status }));

/** Fake checks: every record there and waiting, unless a test says otherwise. */
function checks(overrides: Partial<StaleChecks> = {}): StaleChecks {
  return {
    pendingQuestionIds: vi.fn(async () => [GRANT_ID, '43']),
    getTicket: vi.fn(async () => ({ id: Number(TASK_ID), status: 'review' })),
    getSocialPost: vi.fn(async () => ({ status: 'needs_approval' })),
    getChat: vi.fn(async () => ({ id: CHAT_ID })),
    grantPlaces: vi.fn(async () => []),
    missionPlace: vi.fn(async (id: string) => ({ id, config: null })),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('targetFor and routeFor: every link_type → its screen', () => {
  it.each([
    ['question', GRANT_ID, routes.cc.questions],
    ['task', TASK_ID, routes.cc.ticket(TASK_ID)],
    ['social_post', POST_ID, routes.cc.social(POST_ID)],
    ['chat', CHAT_ID, routes.chat(CHAT_ID)],
  ])('%s → its record’s screen', (type, id, route) => {
    const target = targetFor(link(type, id));
    expect(target).toEqual({ kind: expect.any(String), id });
    expect(routeFor(target)).toBe(route);
  });

  it.each([
    ['mission', '9001'],
    ['approval_grant', POST_ID],
    ['playbook', '5'],
    ['__proto__', '1'],
    ['constructor', '1'],
    ['', GRANT_ID],
  ])('%s %j → no target and no route (no screen for it on the phone)', (type, id) => {
    expect(targetFor(link(type, id))).toBe(HOME_TARGET);
    expect(routeFor(targetFor(link(type, id)))).toBeNull();
  });

  it('an approval (a grant row id) and a Mission (a UUID) are targets with no fixed route', () => {
    expect(targetFor(link('approval_grant', GRANT_ID))).toEqual({ kind: 'approval', id: GRANT_ID });
    expect(targetFor(link('mission', POST_ID))).toEqual({ kind: 'mission', id: POST_ID });
    expect(routeFor(targetFor(link('approval_grant', GRANT_ID)))).toBeNull();
    expect(routeFor(targetFor(link('mission', POST_ID)))).toBeNull();
  });

  it('no link at all → home', () => {
    expect(targetFor({})).toBe(HOME_TARGET);
    expect(targetFor(link('question'))).toBe(HOME_TARGET);
    expect(targetFor(link('task', ''))).toBe(HOME_TARGET);
  });

  it.each([
    ['question', 'abc'],
    ['question', '0'],
    ['question', '-1'],
    ['question', ' 42'],
    ['question', POST_ID],
    ['task', '12a'],
    ['task', '1.5'],
    ['task', POST_ID],
    ['task', '../17'],
    ['social_post', '42'],
    ['social_post', `${POST_ID}x`],
    ['social_post', '..'],
    ['chat', 'new'],
    ['chat', '42'],
    ['chat', '../settings'],
  ])('%s with a malformed link_id %j → home, no builder called', (type, id) => {
    expect(targetFor(link(type, id))).toBe(HOME_TARGET);
  });

  it('reads a parsed v2 payload as it is', () => {
    const payload = parsePushData(FULL);
    expect(payload).not.toBeNull();
    expect(targetFor(payload!)).toEqual(QUESTION);
  });

  it('a target is frozen', () => {
    expect(Object.isFrozen(targetFor(link('chat', CHAT_ID)))).toBe(true);
    expect(Object.isFrozen(HOME_TARGET)).toBe(true);
  });
});

describe('resolveTarget: each record checked before its screen opens (KP9)', () => {
  it('no target resolves to no route (the push opens the inbox) and asks nothing', async () => {
    const fake = checks();
    await expect(resolveTarget(HOME_TARGET, fake)).resolves.toEqual({ route: null });
    expect(fake.pendingQuestionIds).not.toHaveBeenCalled();
    expect(fake.getTicket).not.toHaveBeenCalled();
    expect(fake.getSocialPost).not.toHaveBeenCalled();
    expect(fake.getChat).not.toHaveBeenCalled();
  });

  it('a pending question → Questions; answered or closed → Questions with the notice', async () => {
    await expect(resolveTarget(QUESTION, checks())).resolves.toEqual({
      route: routes.cc.questions,
    });
    const answered = checks({ pendingQuestionIds: async () => ['43'] });
    await expect(resolveTarget(QUESTION, answered)).resolves.toEqual({
      route: routes.cc.questions,
      notice: PUSH_LINK_COPY.questionGone,
    });
  });

  it('a ticket found → the ticket; 404 → the Board with the notice', async () => {
    const fake = checks();
    await expect(resolveTarget(TICKET, fake)).resolves.toEqual({
      route: routes.cc.ticket(TASK_ID),
    });
    expect(fake.getTicket).toHaveBeenCalledWith(TASK_ID, expect.any(AbortSignal));
    const gone = checks({ getTicket: failing('not_found', 404) });
    await expect(resolveTarget(TICKET, gone)).resolves.toEqual({
      route: routes.cc.board,
      notice: PUSH_LINK_COPY.ticketGone,
    });
  });

  it('a post waiting for approval → the post; any other status or 404 → no route, the notice', async () => {
    await expect(resolveTarget(SOCIAL, checks())).resolves.toEqual({
      route: routes.cc.social(POST_ID),
    });
    const postGone = { route: null, notice: PUSH_LINK_COPY.postGone };
    for (const status of ['approved', 'published', 'changes_requested', null]) {
      const moved = checks({ getSocialPost: async () => ({ status }) });
      await expect(resolveTarget(SOCIAL, moved)).resolves.toEqual(postGone);
    }
    const gone = checks({ getSocialPost: failing('not_found', 404) });
    await expect(resolveTarget(SOCIAL, gone)).resolves.toEqual(postGone);
  });

  it('a chat found → the chat; 404 or 403 → no route, the notice (D-STALE-CHAT)', async () => {
    await expect(resolveTarget(CHAT, checks())).resolves.toEqual({ route: routes.chat(CHAT_ID) });
    const chatGone = { route: null, notice: PUSH_LINK_COPY.chatGone };
    const gone = checks({ getChat: failing('not_found', 404) });
    const theirs = checks({ getChat: failing('forbidden', 403) });
    await expect(resolveTarget(CHAT, gone)).resolves.toEqual(chatGone);
    await expect(resolveTarget(CHAT, theirs)).resolves.toEqual(chatGone);
  });

  it('a 403 on the questions list (owner/admin only before W1 US-006a) → Questions, no notice', async () => {
    const refused = checks({ pendingQuestionIds: failing('forbidden', 403) });
    await expect(resolveTarget(QUESTION, refused)).resolves.toEqual({
      route: routes.cc.questions,
    });
  });

  it('a 403 on a ticket or a post → its screen, which shows its own state', async () => {
    const ticket = checks({ getTicket: failing('forbidden', 403) });
    const post = checks({ getSocialPost: failing('forbidden', 403) });
    await expect(resolveTarget(TICKET, ticket)).resolves.toEqual({
      route: routes.cc.ticket(TASK_ID),
    });
    await expect(resolveTarget(SOCIAL, post)).resolves.toEqual({
      route: routes.cc.social(POST_ID),
    });
  });
});

describe('resolveTarget: no answer → the target with no notice', () => {
  const OFFLINE = failing('network');
  const offline = checks({
    pendingQuestionIds: OFFLINE,
    getTicket: OFFLINE,
    getSocialPost: OFFLINE,
    getChat: OFFLINE,
  });

  it.each([QUESTION, TICKET, SOCIAL, CHAT])(
    'a network failure on $kind → its screen',
    async (t) => {
      await expect(resolveTarget(t, offline)).resolves.toEqual({ route: routeFor(t) });
    },
  );

  it.each([
    ['a server error', failing('server', 500)],
    ['an answer this version cannot read', failing('invalid_response')],
    ['a sign-in that lapsed', failing('auth', 401)],
    [
      'a check that throws at once',
      () => {
        throw new TypeError('bad');
      },
    ],
    ['a plain rejection', () => Promise.reject(new Error('boom'))],
  ])('%s → the target, no notice', async (_what, getChat) => {
    await expect(resolveTarget(CHAT, checks({ getChat }))).resolves.toEqual({
      route: routes.chat(CHAT_ID),
    });
  });

  it(`a check slower than STALE_CHECK_TIMEOUT_MS (${STALE_CHECK_TIMEOUT_MS}) is aborted → the target`, async () => {
    expect(STALE_CHECK_TIMEOUT_MS).toBe(4000);
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const slow = checks({
      getTicket: (_id, signal) => {
        seen = signal;
        return new Promise(() => undefined);
      },
    });
    let settled: unknown;
    void resolveTarget(TICKET, slow).then((value) => (settled = value));
    await vi.advanceTimersByTimeAsync(STALE_CHECK_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ route: routes.cc.ticket(TASK_ID) });
    expect(seen?.aborted).toBe(true);
  });

  it('a timeout passed in is used instead of the default', async () => {
    vi.useFakeTimers();
    const slow = checks({ getChat: () => new Promise(() => undefined) });
    const pending = resolveTarget(CHAT, slow, 10);
    await vi.advanceTimersByTimeAsync(10);
    await expect(pending).resolves.toEqual({ route: routes.chat(CHAT_ID) });
  });

  it('a check that answers in time leaves no timer behind', async () => {
    vi.useFakeTimers();
    await expect(resolveTarget(CHAT, checks())).resolves.toEqual({ route: routes.chat(CHAT_ID) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the log carries the kinds only: no id', async () => {
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
    for (const target of [QUESTION, TICKET, SOCIAL, CHAT]) await resolveTarget(target, offline);
    expect(debug).toHaveBeenCalled();
    const logged = JSON.stringify(debug.mock.calls);
    for (const id of [GRANT_ID, TASK_ID, POST_ID, CHAT_ID]) expect(logged).not.toContain(id);
  });
});

describe('the notices', () => {
  it('name no status code, internal id or plan', () => {
    for (const line of Object.values(PUSH_LINK_COPY)) {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(/\b(?:id|plan|plans|credits?|price|resum\w*)\b/i);
      expect(line.endsWith('.')).toBe(true);
    }
  });
});

describe('staleChecksFor: the checks over the one client', () => {
  it('asks for the open questions with the pending question filter', async () => {
    const { client, calls } = harness(() => jsonReply(200, { grants: [{ id: 43 }] }));
    await expect(resolveTarget(QUESTION, staleChecksFor(client))).resolves.toEqual({
      route: routes.cc.questions,
      notice: PUSH_LINK_COPY.questionGone,
    });
    const call = sent(calls[0]);
    expect(call.path).toBe('/api/v1/approval-grants');
    expect(call.query.get('status')).toBe('pending');
    expect(call.query.get('kind')).toBe('question');
  });

  it('a ticket the server answers 404 for → the Board with the notice', async () => {
    const { client, calls } = harness(() => reply(404, '{"detail":"Task not found"}'));
    await expect(resolveTarget(TICKET, staleChecksFor(client))).resolves.toEqual({
      route: routes.cc.board,
      notice: PUSH_LINK_COPY.ticketGone,
    });
    expect(sent(calls[0]).path).toBe(`/api/v1/tasks/${TASK_ID}`);
  });

  it('a post as it will publish, read for its status', async () => {
    const { client, calls } = harness(() =>
      jsonReply(200, { id: POST_ID, status: 'needs_approval', content: 'Lisbon' }),
    );
    await expect(resolveTarget(SOCIAL, staleChecksFor(client))).resolves.toEqual({
      route: routes.cc.social(POST_ID),
    });
    expect(sent(calls[0]).path).toBe(`/api/socials/posts/${POST_ID}`);
  });

  it("another person's chat (403) → no route, the notice", async () => {
    const { client, calls } = harness(() => reply(403, '{"detail":"Forbidden"}'));
    await expect(resolveTarget(CHAT, staleChecksFor(client))).resolves.toEqual({
      route: null,
      notice: PUSH_LINK_COPY.chatGone,
    });
    expect(sent(calls[0]).path).toBe(`/api/chat/${CHAT_ID}`);
  });

  it('a server that never answers is cut off at the timeout → the target', async () => {
    vi.useFakeTimers();
    const { client } = harness((request) => hangUntilAborted(request) as never);
    const pending = resolveTarget(TICKET, staleChecksFor(client));
    await vi.advanceTimersByTimeAsync(STALE_CHECK_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ route: routes.cc.ticket(TASK_ID) });
  });
});
