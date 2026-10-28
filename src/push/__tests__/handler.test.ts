// The action handler (US-015d): a verified reply posts its answer once, marks the bell notification
// read, dismisses the notification and says the server's result; the same response twice posts once;
// 422 or another recorded answer is 'already answered'; offline is 'Not sent' with no retry; an
// unverified reply posts nothing; Open goes to the stale-checked route and marks read; a cold start
// then the same warm response is handled once. Fakes for the port, the key store, the client (the
// foundation's fake transport), the router and the Toast.

import { describe, expect, it } from 'vitest';

import { API_ERROR_COPY } from '../../api/strings';
import { ROLE_COPY } from '../../auth/strings';
import { routes } from '../../navigation/routes';
import { DEFAULT_ACTION_ID, HANDLED_KEYS_ITEM } from '../config';
import { handleResponse } from '../inbound/handler';
import { startResponses } from '../inbound/responses';
import { staleChecksFor } from '../links/stale';
import { inboxRoute } from '../nav';
import { PUSH_ACTION_COPY, PUSH_LINK_COPY } from '../strings';
import {
  ANSWER_PATH,
  NOW_S,
  OTHER_KEY,
  QUESTION_FIELDS,
  READ_PATH,
  REPLY_TEXT,
  REVIEW_FIELDS,
  answeredWith,
  memoryStorage,
  offline,
  phoneRecord,
  refusedWith,
  response,
  responsesPort,
  settle,
  signed,
  world,
  type Script,
  type WorldOptions,
} from './handler-fixtures';
import { NOTIFICATION_ID } from './data-fixtures';
import { IOS_ID } from './inbound-fixtures';

const QUESTION = signed(QUESTION_FIELDS);
const REPLY = response(QUESTION, 'reply', { userText: `  ${REPLY_TEXT}  ` });
const ANSWERED: Script = { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY_TEXT) };

describe('handleResponse: a reply from the notification', () => {
  it('a verified reply: one POST with answer_text, mark read, dismiss, "Answered #0419."', async () => {
    const run = world({ script: ANSWERED });
    const outcome = await handleResponse(REPLY, run.deps);
    expect(outcome).toEqual({ route: routes.cc.questions, toast: 'Answered #0419.' });
    expect(run.requests()).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: ANSWER_PATH,
        body: { answer_text: REPLY_TEXT },
      }),
      expect.objectContaining({ method: 'POST', path: READ_PATH }),
    ]);
    expect(run.seen).toEqual({
      routes: [routes.cc.questions],
      toasts: ['Answered #0419.'],
      dismissed: [IOS_ID],
    });
    expect(run.refreshes()).toBe(1);
  });

  it('a bare ticket number reads the same; no number says "Answered."', async () => {
    const bare = signed({ ...QUESTION_FIELDS, ticket_number: '0419' });
    const run = world({ script: ANSWERED });
    expect(
      await handleResponse(response(bare, 'reply', { userText: REPLY_TEXT }), run.deps),
    ).toMatchObject({ toast: 'Answered #0419.' });
    const { ticket_number: _dropped, ...rest } = QUESTION_FIELDS;
    const none = world({ script: ANSWERED });
    expect(
      await handleResponse(response(signed(rest), 'reply', { userText: REPLY_TEXT }), none.deps),
    ).toMatchObject({ toast: 'Answered.' });
  });

  it('the same response twice → one POST; the second does nothing', async () => {
    const run = world({ script: ANSWERED });
    await handleResponse(REPLY, run.deps);
    expect(await handleResponse(REPLY, run.deps)).toBeNull();
    expect(run.requests().filter((call) => call.path === ANSWER_PATH)).toHaveLength(1);
    expect(run.seen.routes).toHaveLength(1);
  });

  it('two deliveries at once still post once (claimed before the first await)', async () => {
    const run = world({ script: ANSWERED });
    const [first, second] = await Promise.all([
      handleResponse(REPLY, run.deps),
      handleResponse(REPLY, run.deps),
    ]);
    expect([first?.toast, second]).toEqual(['Answered #0419.', null]);
    expect(run.requests().filter((call) => call.path === ANSWER_PATH)).toHaveLength(1);
  });

  it('handled keys persist: a later launch over the same MMKV does nothing, and stores keys only', async () => {
    const storage = memoryStorage();
    await handleResponse(REPLY, world({ script: ANSWERED, storage }).deps);
    const later = world({ script: ANSWERED, storage });
    expect(await handleResponse(REPLY, later.deps)).toBeNull();
    expect(later.requests()).toEqual([]);
    expect(JSON.parse(storage.items.get(HANDLED_KEYS_ITEM) ?? '[]')).toEqual([`${IOS_ID}:reply`]);
  });

  it('422 → already answered; the notification is still read and dismissed', async () => {
    const run = world({
      script: {
        [`POST ${ANSWER_PATH}`]: refusedWith(422, 'Question is not open (status: granted)'),
      },
    });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_ACTION_COPY.alreadyAnswered,
    });
    expect(run.requests().map((call) => call.path)).toEqual([ANSWER_PATH, READ_PATH]);
    expect(run.seen.dismissed).toEqual([IOS_ID]);
  });

  it('200 with another answer_text (a compare-and-swap loser) → already answered', async () => {
    const run = world({ script: { [`POST ${ANSWER_PATH}`]: answeredWith('No, wait') } });
    expect(await handleResponse(REPLY, run.deps)).toMatchObject({
      toast: PUSH_ACTION_COPY.alreadyAnswered,
    });
  });

  it('200 with the words after Python strip() (U+001F kept by trim()) → answered', async () => {
    const run = world({ script: { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY_TEXT) } });
    const reply = response(QUESTION, 'reply', { userText: `\u001f${REPLY_TEXT}\u0085` });
    expect(await handleResponse(reply, run.deps)).toMatchObject({ toast: 'Answered #0419.' });
  });

  it('offline → "Not sent" and the questions route; one request, no retry, nothing marked read', async () => {
    const run = world({ script: { [`POST ${ANSWER_PATH}`]: offline } });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_ACTION_COPY.notSent,
    });
    expect(run.requests().map((call) => call.path)).toEqual([ANSWER_PATH]);
    expect(run.seen.dismissed).toEqual([]);
    expect(run.refreshes()).toBe(0);
  });

  it('403 → the taxonomy forbidden copy, nothing marked read', async () => {
    const run = world({ script: { [`POST ${ANSWER_PATH}`]: refusedWith(403, 'Admin only') } });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: API_ERROR_COPY.forbidden,
    });
    expect(run.requests().map((call) => call.path)).toEqual([ANSWER_PATH]);
  });

  it('no line ever says the work is resuming (KP8)', async () => {
    const scripts: Script[] = [
      ANSWERED,
      { [`POST ${ANSWER_PATH}`]: answeredWith('other') },
      { [`POST ${ANSWER_PATH}`]: refusedWith(422, 'not open') },
      { [`POST ${ANSWER_PATH}`]: offline },
    ];
    for (const script of scripts) {
      const run = world({ script });
      await handleResponse(REPLY, run.deps);
      expect(run.seen.toasts.join(' ')).not.toMatch(/resum/i);
    }
  });
});

describe('handleResponse: nothing is sent for a push that does not verify (KP6)', () => {
  type Unverified = Readonly<{ push: unknown } & Pick<WorldOptions, 'record' | 'loadFails'>>;

  it.each<[string, Unverified]>([
    ['signed with another key', { push: signed(QUESTION_FIELDS, OTHER_KEY) }],
    ['older than 7 days', { push: signed({ ...QUESTION_FIELDS, iat: NOW_S - 604801 }) }],
    ['a v1 payload', { push: { ...QUESTION, v: 1 } }],
    ['no push record', { push: QUESTION, record: null }],
    [
      'another server’s record',
      { push: QUESTION, record: phoneRecord({ serverOrigin: 'https://own.example' }) },
    ],
    ['a keychain that refuses the read', { push: QUESTION, loadFails: true }],
  ])('%s → no request, the inbox, the unverified copy', async (_name, setup) => {
    const run = world({ ...setup, script: ANSWERED });
    const outcome = await handleResponse(
      response(setup.push, 'reply', { userText: REPLY_TEXT }),
      run.deps,
    );
    // a v2 payload's notification_id (as received, unverified) only picks the inbox row shown first
    const first = (setup.push as { v: number }).v === 2 ? NOTIFICATION_ID : null;
    expect(outcome).toEqual({ route: inboxRoute(first), toast: PUSH_ACTION_COPY.unverified });
    expect(run.requests()).toEqual([]);
    expect(run.seen.dismissed).toEqual([]);
  });

  it('an unreadable response opens the inbox with its line and never throws', async () => {
    const run = world();
    expect(await handleResponse({ notification: null }, run.deps)).toEqual({
      route: inboxRoute(),
      toast: PUSH_ACTION_COPY.uncheckedTap,
    });
    expect(run.requests()).toEqual([]);
  });

  it('another workspace’s verified push → the inbox and its copy; nothing sent or marked read', async () => {
    const run = world({ script: ANSWERED, workspaceId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: inboxRoute(),
      toast: PUSH_ACTION_COPY.otherWorkspace,
    });
    expect(run.requests()).toEqual([]);
  });
});

describe('handleResponse: neutral replies post nothing', () => {
  it('a viewer → the question’s route with the viewer copy', async () => {
    const run = world({ script: ANSWERED, role: 'viewer' });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: ROLE_COPY.viewerReadOnly,
    });
    expect(run.requests()).toEqual([]);
  });

  it('a role not read yet → the question’s route with "Answer it here."', async () => {
    const run = world({ script: ANSWERED, role: null });
    expect(await handleResponse(REPLY, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_ACTION_COPY.answerHere,
    });
    expect(run.requests()).toEqual([]);
  });

  it('a blank reply → the question’s route with "Answer it here."', async () => {
    const run = world({ script: ANSWERED });
    const blank = response(QUESTION, 'reply', { userText: '   ' });
    expect(await handleResponse(blank, run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_ACTION_COPY.answerHere,
    });
    expect(run.requests()).toEqual([]);
  });
});

describe('handleResponse: Open and a tap', () => {
  it('Open on an open question → Questions, no notice, then mark read', async () => {
    const run = world();
    expect(await handleResponse(response(QUESTION, 'open'), run.deps)).toEqual({
      route: routes.cc.questions,
    });
    expect(run.requests()).toEqual([expect.objectContaining({ method: 'POST', path: READ_PATH })]);
    expect(run.seen.toasts).toEqual([]);
  });

  it('Open on an answered question → Questions with its notice', async () => {
    const run = world({ checks: { pendingQuestionIds: async () => ['7'] } });
    expect(await handleResponse(response(QUESTION, 'open'), run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_LINK_COPY.questionGone,
    });
  });

  it('a tap on a review push → the ticket; a check that fails otherwise opens it unchecked', async () => {
    const review = signed(REVIEW_FIELDS);
    const run = world();
    expect(await handleResponse(response(review, DEFAULT_ACTION_ID), run.deps)).toEqual({
      route: routes.cc.ticket('8812'),
    });
    const failing = world({ checks: { getTicket: () => Promise.reject(new Error('timeout')) } });
    expect(await handleResponse(response(review, 'open'), failing.deps)).toEqual({
      route: routes.cc.ticket('8812'),
    });
    expect(failing.requests().map((call) => call.path)).toEqual([READ_PATH]);
  });

  it('a stale ticket (404 from the check) → the board and its notice', async () => {
    const run = world({
      script: { [`GET /api/v1/tasks/8812`]: refusedWith(404, 'Task not found') },
    });
    const deps = { ...run.deps, checks: staleChecksFor(run.deps.client) };
    expect(await handleResponse(response(signed(REVIEW_FIELDS), 'open'), deps)).toEqual({
      route: routes.cc.board,
      toast: PUSH_LINK_COPY.ticketGone,
    });
  });

  it('a failing mark read is ignored', async () => {
    const run = world({ script: { [`POST ${READ_PATH}`]: refusedWith(500, 'boom') } });
    expect(await handleResponse(response(QUESTION, 'open'), run.deps)).toEqual({
      route: routes.cc.questions,
    });
  });

  it('a router that throws never makes the handler throw', async () => {
    const run = world({ navigateFails: true });
    await expect(handleResponse(response(QUESTION, 'open'), run.deps)).resolves.toEqual({
      route: routes.cc.questions,
    });
  });
});

describe('startResponses: the cold start, then warm taps', () => {
  it('a cold start then the same warm response → handled once', async () => {
    const run = world({ script: ANSWERED });
    const fake = responsesPort(REPLY);
    const responses = startResponses({ ...run.deps, port: fake.port });
    fake.fire(REPLY);
    expect(await responses.coldStart).toMatchObject({ toast: 'Answered #0419.' });
    await settle();
    expect(run.requests().filter((call) => call.path === ANSWER_PATH)).toHaveLength(1);
    expect(fake.calls).toEqual(['getLast', 'clearLast', 'listen']);
    responses.remove();
    expect(fake.calls).toEqual(['getLast', 'clearLast', 'listen', 'remove']);
  });

  it('no cold start: a warm tap is handled through the listener', async () => {
    const run = world();
    const fake = responsesPort(null);
    const responses = startResponses({ ...run.deps, port: fake.port });
    expect(await responses.coldStart).toBeNull();
    fake.fire(response(QUESTION, 'open'));
    await settle();
    expect(run.seen.routes).toEqual([routes.cc.questions]);
    expect(run.requests().map((call) => call.path)).toEqual([READ_PATH]);
  });

  it('a port that throws on read or listen never throws into the app', async () => {
    const run = world();
    const fake = responsesPort(null);
    const port = {
      ...fake.port,
      getLastNotificationResponse: () => {
        throw new Error('native read failed');
      },
      addNotificationResponseReceivedListener: () => {
        throw new Error('native listen failed');
      },
    };
    const responses = startResponses({ ...run.deps, port });
    expect(await responses.coldStart).toBeNull();
    expect(() => responses.remove()).not.toThrow();
  });
});
