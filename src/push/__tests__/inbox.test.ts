// The notifications inbox (fix/notification-taps): the rows (newest first, the push's own first,
// the unread dot said as well as drawn), the route and its focus, the server's shapes (a row this
// version cannot read is left out), the calls, where a row opens (the same screen its push would; an
// approval or a Mission plan in the chat its card sits in; Studio for one with no screen; a line for
// one that names nothing), and what a tap and Mark all read do.

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import { jsonReply } from '../../api/__tests__/fake-transport';
import { routes } from '../../navigation/routes';
import { markAllRead, openInboxRow, type InboxActionDeps } from '../inbox/actions';
import {
  INBOX_PAGE_SIZE,
  getMissionPlace,
  listNotifications,
  markAllNotificationsRead,
  pendingGrantPlaces,
  unreadNotifications,
} from '../inbox/api';
import { hasUnread, inboxButtonLabel, inboxRows, unreadBadge, withRead } from '../inbox/model';
import { inboxOpenFor } from '../inbox/open';
import { inboxListSchema, type InboxNotification } from '../inbox/schemas';
import type { StaleChecks } from '../links/stale';
import { INBOX_FOCUS_PARAM, inboxFocusFrom, inboxRoute, pushScreens } from '../nav';
import { PUSH_INBOX_COPY, PUSH_LINK_COPY } from '../strings';
import { POST_ID, harness, sent } from './data-fixtures';
import { CARD_CHAT_ID, OPEN_CHECKS } from './handler-fixtures';

const NOW = new Date('2026-10-28T09:00:00Z');
const A = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const B = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const C = '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f';
const STUDIO = 'https://studio.example';

function row(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: A,
    event_type: 'auto_message',
    title: 'Auto messaged you',
    message: 'Your Lisbon deck is ready.',
    link_type: 'chat',
    link_id: CARD_CHAT_ID,
    agent_name: 'Auto',
    read_at: null,
    created_at: '2026-10-28T08:58:00Z',
    ...overrides,
  };
}

describe('the rows', () => {
  const list = [
    row({ id: A }),
    row({ id: B, read_at: '2026-10-28T08:00:00Z', created_at: '2026-10-27T10:00:00Z' }),
    row({ id: C, message: null, title: 'Ready for review: Lisbon deck' }),
  ];

  it('keep the server’s order (newest first) with the time in words and the unread flag', () => {
    const rows = inboxRows(list, NOW);
    expect(rows.map((view) => [view.id, view.time, view.unread])).toEqual([
      [A, '2 min', true],
      [B, 'Yesterday', false],
      [C, '2 min', true],
    ]);
    expect(rows.every((view) => !view.focused)).toBe(true);
  });

  it('put the push’s own row first, marked focused (case does not matter)', () => {
    const rows = inboxRows(list, NOW, C);
    expect(rows.map((view) => view.id)).toEqual([C, A, B]);
    expect(rows[0]?.focused).toBe(true);
    expect(inboxRows(list, NOW, '9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f').map((v) => v.id)).toEqual([
      A,
      B,
      C,
    ]);
  });

  it('say "Unread" first to VoiceOver, then the title, the message and the time', () => {
    const [first, second, third] = inboxRows(list, NOW);
    expect(first?.accessibilityLabel).toBe(
      'Unread, Auto messaged you, Your Lisbon deck is ready., 2 min',
    );
    expect(second?.accessibilityLabel).toBe(
      'Auto messaged you, Your Lisbon deck is ready., Yesterday',
    );
    expect(third?.message).toBeNull();
  });

  it('a time the server sent unreadable is no words, never a crash', () => {
    expect(inboxRows([row({ created_at: 'not a date' })], NOW)[0]?.time).toBe('');
  });

  it('withRead marks rows in a new list and never changes the old one', () => {
    const at = '2026-10-28T09:00:00Z';
    const next = withRead(list, new Set([A]), at);
    expect(next).not.toBe(list);
    expect(next[0]?.read_at).toBe(at);
    expect(list[0]?.read_at).toBeNull();
    expect(next[1]).toBe(list[1]);
    expect(withRead(list, 'all', at).every((item) => item.read_at !== null)).toBe(true);
    expect(hasUnread(list)).toBe(true);
    expect(hasUnread(withRead(list, 'all', at))).toBe(false);
  });

  it('the menu number and its words', () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe(3);
    expect(inboxButtonLabel(0)).toBe('Notifications');
    expect(inboxButtonLabel(1)).toBe('Notifications, 1 unread');
    expect(inboxButtonLabel(12)).toBe('Notifications, 12 unread');
  });
});

describe('the route', () => {
  it('is /notifications, with the focus only when it is a notification id', () => {
    expect(pushScreens.inbox).toBe('/notifications');
    expect(inboxRoute()).toBe('/notifications');
    expect(inboxRoute('1001')).toBe('/notifications');
    expect(inboxRoute(` ${A} `)).toBe(`/notifications?${INBOX_FOCUS_PARAM}=${A}`);
  });

  it('reads the focus back, only when it is an id', () => {
    expect(inboxFocusFrom({ focus: A.toUpperCase() })).toBe(A);
    expect(inboxFocusFrom({ focus: [B, A] })).toBe(B);
    expect(inboxFocusFrom({ focus: '../settings' })).toBeNull();
    expect(inboxFocusFrom({})).toBeNull();
  });
});

describe('the server’s answers', () => {
  it('a row this version cannot read is left out, not the list', () => {
    const parsed = inboxListSchema.parse({
      success: true,
      notifications: [row(), { id: 7, title: 'old' }, row({ id: B, message: null })],
      total: 3,
      limit: 50,
      offset: 0,
    });
    expect(parsed.notifications.map((item) => item.id)).toEqual([A, B]);
    expect(parsed.total).toBe(3);
  });

  it('the calls go through the one client to the pinned routes', async () => {
    const { client, calls } = harness((request) => {
      const path = new URL(request.url).pathname;
      if (path === '/api/notifications/unread-count')
        return jsonReply(200, { success: true, count: 4 });
      if (path === '/api/notifications') {
        return jsonReply(200, { success: true, notifications: [row()], total: 1 });
      }
      if (path === '/api/v1/approval-grants') {
        return jsonReply(200, { grants: [{ id: 77, details: { conversation_id: CARD_CHAT_ID } }] });
      }
      if (path.startsWith('/api/missions/')) {
        return jsonReply(200, { id: POST_ID, config: { origin_chat_id: CARD_CHAT_ID } });
      }
      return jsonReply(200, { success: true, marked_count: 2 });
    });
    await expect(listNotifications(client)).resolves.toMatchObject({ total: 1 });
    await expect(unreadNotifications(client)).resolves.toBe(4);
    await expect(markAllNotificationsRead(client)).resolves.toBeUndefined();
    await expect(pendingGrantPlaces(client)).resolves.toEqual([
      { id: 77, details: { conversation_id: CARD_CHAT_ID } },
    ]);
    await expect(getMissionPlace(client, POST_ID)).resolves.toMatchObject({
      config: { origin_chat_id: CARD_CHAT_ID },
    });
    const seen = calls.map((call) => sent(call));
    expect(seen.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /api/notifications',
      'GET /api/notifications/unread-count',
      'POST /api/notifications/read-all',
      'GET /api/v1/approval-grants',
      `GET /api/missions/${POST_ID}`,
    ]);
    expect(seen[0]?.query.get('limit')).toBe(String(INBOX_PAGE_SIZE));
    expect(seen[3]?.query.get('status')).toBe('pending');
  });

  it('a Mission id that is not a UUID is refused before anything is sent', () => {
    const { client, calls } = harness();
    expect(() => getMissionPlace(client, '../tasks')).toThrow(TypeError);
    expect(calls).toEqual([]);
  });
});

const checks = (overrides: Partial<StaleChecks> = {}): StaleChecks => ({
  ...OPEN_CHECKS,
  ...overrides,
});

describe('where a row opens', () => {
  it.each([
    ['task', '8812', routes.cc.ticket('8812')],
    ['chat', CARD_CHAT_ID, routes.chat(CARD_CHAT_ID)],
    ['question', '42', routes.cc.questions],
    ['social_post', POST_ID, routes.cc.social(POST_ID)],
  ])('%s → its own screen, as its push', async (link_type, link_id, route) => {
    await expect(inboxOpenFor({ link_type, link_id }, checks(), STUDIO)).resolves.toEqual({
      kind: 'route',
      route,
    });
  });

  it('an approval opens the chat its card is in, else its ticket, else Studio’s governance tab', async () => {
    const approval = { link_type: 'approval_grant', link_id: '77' };
    await expect(inboxOpenFor(approval, checks(), STUDIO)).resolves.toEqual({
      kind: 'route',
      route: routes.chat(CARD_CHAT_ID),
    });
    const onTicket = checks({
      grantPlaces: async () => [{ id: 77, details: { board_task_id: 17 } }],
    });
    await expect(inboxOpenFor(approval, onTicket, STUDIO)).resolves.toEqual({
      kind: 'route',
      route: routes.cc.ticket('17'),
    });
    const nowhere = checks({ grantPlaces: async () => [{ id: 77, details: null }] });
    await expect(inboxOpenFor(approval, nowhere, STUDIO)).resolves.toEqual({
      kind: 'studio',
      url: `${STUDIO}/command-center?tab=governance`,
    });
  });

  it('an approval already decided says so and opens nothing', async () => {
    const decided = checks({ grantPlaces: async () => [] });
    await expect(
      inboxOpenFor({ link_type: 'approval_grant', link_id: '77' }, decided, STUDIO),
    ).resolves.toEqual({ kind: 'none', notice: PUSH_LINK_COPY.approvalGone });
  });

  it('a Mission plan opens the chat it was launched from, else its Studio page', async () => {
    const mission = { link_type: 'mission', link_id: POST_ID };
    await expect(inboxOpenFor(mission, checks(), STUDIO)).resolves.toEqual({
      kind: 'route',
      route: routes.chat(CARD_CHAT_ID),
    });
    const noChat = checks({ missionPlace: async (id) => ({ id, config: null }) });
    await expect(inboxOpenFor(mission, noChat, STUDIO)).resolves.toEqual({
      kind: 'studio',
      url: `${STUDIO}/missions/${POST_ID}`,
    });
    const gone = checks({
      missionPlace: () => Promise.reject(new ApiError('not_found', { status: 404 })),
    });
    await expect(inboxOpenFor(mission, gone, STUDIO)).resolves.toEqual({
      kind: 'none',
      notice: PUSH_LINK_COPY.missionGone,
    });
  });

  it('a row that names nothing the phone knows says so', async () => {
    for (const link of [
      { link_type: null, link_id: null },
      { link_type: 'playbook', link_id: '5' },
      { link_type: 'task', link_id: '../5' },
    ]) {
      await expect(inboxOpenFor(link, checks(), STUDIO)).resolves.toEqual({
        kind: 'none',
        notice: PUSH_INBOX_COPY.nothingToOpen,
      });
    }
  });

  it('with no Studio address an approval with no card says there is nothing to open', async () => {
    const nowhere = checks({ grantPlaces: async () => [{ id: 77, details: null }] });
    await expect(
      inboxOpenFor({ link_type: 'approval_grant', link_id: '77' }, nowhere, ''),
    ).resolves.toEqual({ kind: 'none', notice: PUSH_INBOX_COPY.nothingToOpen });
  });
});

function deps(overrides: Partial<InboxActionDeps> = {}) {
  const seen = { routes: [] as string[], toasts: [] as string[], read: [] as string[] };
  const value: InboxActionDeps = {
    checks: checks(),
    markRead: async (id) => void seen.read.push(id),
    navigate: (route) => void seen.routes.push(route),
    openBrowser: async () => true,
    notify: (message) => void seen.toasts.push(message),
    webUrl: STUDIO,
    ...overrides,
  };
  return { value, seen };
}

describe('a tap and Mark all read', () => {
  it('an unread row: marked read once, its screen opened', async () => {
    const run = deps();
    await openInboxRow(row(), run.value);
    expect(run.seen).toEqual({ routes: [routes.chat(CARD_CHAT_ID)], toasts: [], read: [A] });
  });

  it('a read row is not marked again', async () => {
    const run = deps();
    await openInboxRow(row({ read_at: '2026-10-28T08:00:00Z' }), run.value);
    expect(run.seen.read).toEqual([]);
  });

  it('a mark that fails still opens the screen, and nothing throws', async () => {
    const run = deps({ markRead: () => Promise.reject(new ApiError('network', {})) });
    await expect(openInboxRow(row(), run.value)).resolves.toMatchObject({ kind: 'route' });
    expect(run.seen.routes).toEqual([routes.chat(CARD_CHAT_ID)]);
  });

  it('a moved record opens its fallback with the notice; a Studio page that will not open says so', async () => {
    const gone = deps({
      checks: checks({
        getTicket: () => Promise.reject(new ApiError('not_found', { status: 404 })),
      }),
    });
    await openInboxRow(row({ link_type: 'task', link_id: '17' }), gone.value);
    expect(gone.seen.routes).toEqual([routes.cc.board]);
    expect(gone.seen.toasts).toEqual([PUSH_LINK_COPY.ticketGone]);
    const browser = vi.fn(async () => false);
    const studio = deps({
      openBrowser: browser,
      checks: checks({ grantPlaces: async () => [{ id: 77, details: null }] }),
    });
    await openInboxRow(row({ link_type: 'approval_grant', link_id: '77' }), studio.value);
    expect(browser).toHaveBeenCalledWith(`${STUDIO}/command-center?tab=governance`);
    expect(studio.seen.toasts).toEqual([PUSH_INBOX_COPY.studioFailed]);
  });

  it('Mark all read: one call, its line; a refusal says the server’s words', async () => {
    const toasts: string[] = [];
    const run = vi.fn(async () => undefined);
    await expect(
      markAllRead(
        run,
        (m) => void toasts.push(m),
        () => 'failed',
      ),
    ).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual([PUSH_INBOX_COPY.allRead]);
    const refused = () => Promise.reject(new ApiError('network', {}));
    await expect(
      markAllRead(
        refused,
        (m) => void toasts.push(m),
        () => 'Offline',
      ),
    ).resolves.toBe(false);
    expect(toasts.at(-1)).toBe('Offline');
  });
});
