// A tap never lands on home with nothing to show (fix/notification-taps). Before: an approval, a
// Mission plan, an unknown link, an unverified or unreadable push and a failed handler all opened
// home, and the notification was gone. Now: an approval opens the chat its card is in (D30), a
// Mission plan the chat it was launched from; everything else that cannot be followed opens the
// notifications inbox, the push's own row first. Only a verified push marks its row read.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { routes } from '../../navigation/routes';
import { DEFAULT_ACTION_ID } from '../config';
import { handleResponse } from '../inbound/handler';
import { inboxRoute } from '../nav';
import { PUSH_ACTION_COPY, PUSH_LINK_COPY } from '../strings';
import { NOTIFICATION_ID, POST_ID, WS } from './data-fixtures';
import {
  CARD_CHAT_ID,
  NOW_S,
  OTHER_KEY,
  READ_PATH,
  response,
  signed,
  world,
} from './handler-fixtures';

function push(link: Record<string, string>, key?: string) {
  return signed(
    {
      v: 2,
      type: 'needs_answer',
      workspace_id: WS,
      notification_id: NOTIFICATION_ID,
      ...link,
      iat: NOW_S,
    },
    key,
  );
}

const tap = (data: unknown) => response(data, DEFAULT_ACTION_ID);
const READ = expect.objectContaining({ method: 'POST', path: READ_PATH });

describe('a verified tap on a push with no fixed screen', () => {
  it('an approval → the chat its card is in, marked read', async () => {
    const run = world();
    const outcome = await handleResponse(
      tap(push({ link_type: 'approval_grant', link_id: '77' })),
      run.deps,
    );
    expect(outcome).toEqual({ route: routes.chat(CARD_CHAT_ID) });
    expect(run.requests()).toEqual([READ]);
  });

  it('a Mission plan → the chat it was launched from, marked read', async () => {
    const run = world();
    const outcome = await handleResponse(
      tap(push({ link_type: 'mission', link_id: POST_ID })),
      run.deps,
    );
    expect(outcome).toEqual({ route: routes.chat(CARD_CHAT_ID) });
    expect(run.requests()).toEqual([READ]);
  });

  it('an approval already decided → the inbox, its row first, with the notice', async () => {
    const run = world({ checks: { grantPlaces: async () => [] } });
    const outcome = await handleResponse(
      tap(push({ link_type: 'approval_grant', link_id: '77' })),
      run.deps,
    );
    expect(outcome).toEqual({
      route: inboxRoute(NOTIFICATION_ID),
      toast: PUSH_LINK_COPY.approvalGone,
    });
    expect(run.requests()).toEqual([READ]);
  });

  it('a Mission the server cannot place → the inbox, its row first', async () => {
    const run = world({
      checks: { missionPlace: () => Promise.reject(new ApiError('server', { status: 500 })) },
    });
    const outcome = await handleResponse(
      tap(push({ link_type: 'mission', link_id: POST_ID })),
      run.deps,
    );
    expect(outcome).toEqual({ route: inboxRoute(NOTIFICATION_ID) });
  });

  it.each([
    ['an unknown link type', { link_type: 'playbook', link_id: '5' }],
    ['no link at all', {}],
    ['a malformed id', { link_type: 'task', link_id: '../5' }],
  ])('%s → the inbox, its row first, marked read', async (_name, link) => {
    const run = world();
    expect(await handleResponse(tap(push(link)), run.deps)).toEqual({
      route: inboxRoute(NOTIFICATION_ID),
    });
    expect(run.requests()).toEqual([READ]);
  });

  it('a chat that is gone → the inbox with its notice, never home', async () => {
    const run = world({
      checks: { getChat: () => Promise.reject(new ApiError('not_found', { status: 404 })) },
    });
    const outcome = await handleResponse(
      tap(push({ link_type: 'chat', link_id: CARD_CHAT_ID })),
      run.deps,
    );
    expect(outcome).toEqual({
      route: inboxRoute(NOTIFICATION_ID),
      toast: PUSH_LINK_COPY.chatGone,
    });
  });
});

describe('a tap that cannot be followed opens the inbox, never home', () => {
  it('unverified → the inbox with the row first and its line; nothing sent or marked read', async () => {
    const run = world();
    const outcome = await handleResponse(
      tap(push({ link_type: 'chat', link_id: CARD_CHAT_ID }, OTHER_KEY)),
      run.deps,
    );
    expect(outcome).toEqual({
      route: inboxRoute(NOTIFICATION_ID),
      toast: PUSH_ACTION_COPY.uncheckedTap,
    });
    expect(run.requests()).toEqual([]);
  });

  it('an unknown action → the inbox, the row first', async () => {
    const run = world();
    const outcome = await handleResponse(
      response(push({ link_type: 'task', link_id: '8812' }), 'snooze'),
      run.deps,
    );
    expect(outcome).toEqual({ route: inboxRoute(NOTIFICATION_ID) });
  });

  it('a handler that fails on its way → the inbox', async () => {
    const run = world();
    const broken = {
      ...run.deps,
      session: {
        ...run.deps.session,
        role: () => {
          throw new Error('no workspace yet');
        },
      },
    };
    expect(await handleResponse(tap(push({ link_type: 'task', link_id: '8812' })), broken)).toEqual(
      { route: inboxRoute() },
    );
    expect(run.seen.routes).toEqual([inboxRoute()]);
  });

  it('no outcome of any tap is home', async () => {
    const cases = [
      tap(push({}, OTHER_KEY)),
      tap({ v: 1 }),
      { notification: null },
      response(push({ link_type: 'mission', link_id: '42' }), DEFAULT_ACTION_ID),
    ];
    for (const item of cases) {
      const run = world();
      const outcome = await handleResponse(item, run.deps);
      expect(outcome?.route).not.toBe(routes.home);
      expect(run.seen.routes).not.toContain(routes.home);
    }
  });
});
