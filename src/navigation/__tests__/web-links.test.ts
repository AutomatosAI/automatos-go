import { describe, expect, it } from 'vitest';

import {
  BOARD_HREF,
  CHAT_HREF,
  DELIVERABLES_HREF,
  DELIVERABLE_PARAM,
  QUESTIONS_HREF,
  chatHref,
  missionHref,
  questionIdHref,
  ticketHref,
} from '../../core/web/lib/ticket-links';
import { RECORD } from '../../connect/__tests__/paired-record';
import { currentServers } from '../../connect/current-server';
import { chatWithTicket, routes } from '../routes';
import { LINK_MAX_LENGTH, appRouteForWebLink, parseQuery, studioUrl } from '../web-links';

const WEB = 'https://ui.example.test';
const DELIVERABLE_ID = '9b1c2a54-0000-4000-8000-0000000000d1';

function open(link: string, webUrl = WEB) {
  return appRouteForWebLink(link, webUrl);
}

describe('appRouteForWebLink: the web links the phone has screens for', () => {
  it('opens a ticket link on that ticket (the web builder, vendored)', () => {
    expect(open(ticketHref(42))).toEqual({ app: routes.cc.ticket(42) });
    expect(open('/command-center?tab=board&task_id=42')).toEqual({ app: '/cc/ticket/42' });
  });

  it('keeps the question a ticket link opens at', () => {
    expect(open(ticketHref('42', 'g-9'))).toEqual({ app: routes.cc.ticket(42, 'g-9') });
  });

  it('opens a question known only by its id on Questions', () => {
    expect(open(questionIdHref('g-9'))).toEqual({ app: routes.cc.questions });
  });

  it('opens the Board, Questions and Calendar tabs', () => {
    expect(open(BOARD_HREF)).toEqual({ app: routes.cc.board });
    expect(open(QUESTIONS_HREF)).toEqual({ app: routes.cc.questions });
    expect(open('/command-center?tab=calendar')).toEqual({ app: routes.cc.calendar });
  });

  it('opens the Board for the Command Centre with no tab or the web default (Summary)', () => {
    expect(open('/command-center')).toEqual({ app: routes.cc.board });
    expect(open('/command-center?tab=summary')).toEqual({ app: routes.cc.board });
  });

  it('opens the Board when a ticket link carries no usable row id', () => {
    expect(open('/command-center?tab=board&task_id=%230419')).toEqual({ app: routes.cc.board });
    expect(open('/command-center?tab=board&task_id=')).toEqual({ app: routes.cc.board });
  });

  it('opens one Deliverable, or the gallery', () => {
    const link = `${DELIVERABLES_HREF}?${DELIVERABLE_PARAM}=${DELIVERABLE_ID}`;
    expect(open(link)).toEqual({ app: routes.cc.deliverable(DELIVERABLE_ID) });
    expect(open(DELIVERABLES_HREF)).toEqual({ app: routes.cc.deliverables });
  });

  it('opens /chat?ticket=… as a new conversation about that ticket (D31)', () => {
    expect(open('/chat?ticket=419')).toEqual({ app: chatWithTicket(419) });
    expect(open('/chat?ticket=419&runtime=1')).toEqual({ app: chatWithTicket(419) });
  });

  it('opens a conversation link on that conversation, and the plain chat on home', () => {
    expect(open(chatHref('c-1'))).toEqual({ app: routes.chat('c-1') });
    expect(open(CHAT_HREF)).toEqual({ app: routes.home });
    expect(open('/chat?ticket=%230419')).toEqual({ app: routes.home });
  });
});

describe('appRouteForWebLink: everything else opens Studio in the system browser', () => {
  it('sends an agent link to EXPO_PUBLIC_WEB_URL + the path, query and all', () => {
    expect(open('/agents?agent=a-1&panel=reports')).toEqual({
      external: `${WEB}/agents?agent=a-1&panel=reports`,
    });
    expect(open(missionHref('m-7'))).toEqual({ external: `${WEB}/missions/m-7` });
  });

  it('sends Command Centre tabs the phone has no screen for to Studio', () => {
    for (const tab of ['activity', 'watchlist', 'governance', 'unknown']) {
      expect(open(`/command-center?tab=${tab}`)).toEqual({
        external: `${WEB}/command-center?tab=${tab}`,
      });
    }
  });

  it('sends a page under a mapped one to Studio (the Deliverables explorer)', () => {
    expect(open('/deliverables/explorer?path=reports')).toEqual({
      external: `${WEB}/deliverables/explorer?path=reports`,
    });
  });

  it('joins a web URL with a trailing slash without doubling it', () => {
    expect(open('/agents', `${WEB}/`)).toEqual({ external: `${WEB}/agents` });
  });

  it('opens nothing outside the app when the build has no web URL; app links still map', () => {
    expect(open('/agents?agent=a-1', '')).toBeNull();
    expect(open(QUESTIONS_HREF, '')).toEqual({ app: routes.cc.questions });
  });
});

describe('appRouteForWebLink: only internal paths are followed', () => {
  it('follows nothing that is not a path in this app', () => {
    for (const link of [
      'https://evil.example/command-center',
      '//evil.example/agents',
      'javascript:alert(1)',
      'command-center?tab=board',
      '',
      '   ',
    ]) {
      expect(open(link)).toBeNull();
    }
  });

  it('follows no link with whitespace or control characters inside it', () => {
    expect(open('/agents?agent=a 1')).toBeNull();
    expect(open('/agents\u0000/x')).toBeNull();
    expect(open('/agents\n')).toEqual({ external: `${WEB}/agents` });
  });

  it('ignores the fragment and a trailing slash', () => {
    expect(open('/command-center/?tab=calendar#today')).toEqual({ app: routes.cc.calendar });
  });

  it('takes no id with a slash, a percent sign or a control character into an app route', () => {
    for (const id of ['a%2Fb', '..%2F..%2Fsettings', 'a%252Fb', 'a%00b', 'a%5Cb', 'a%3Bb']) {
      expect(open(`/deliverables?deliverable=${id}`)).toEqual({ app: routes.cc.deliverables });
      expect(open(`/chat?chatId=${id}`)).toEqual({ app: routes.home });
    }
    expect(open('/deliverables?deliverable=d-1.v2_x')).toEqual({
      app: '/cc/deliverables/d-1.v2_x',
    });
  });

  it(`follows nothing longer than ${LINK_MAX_LENGTH} characters, and reads it not at all`, () => {
    const base = '/agents?pad=';
    const longest = `${base}${'a'.repeat(LINK_MAX_LENGTH - base.length)}`;
    expect(open(longest)).toEqual({ external: `${WEB}${longest}` });
    expect(open(`${longest}a`)).toBeNull();
    const started = performance.now();
    expect(open(`/chat${'/'.repeat(500_000)}x`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("leaves the app's root and the pairing link to Studio: an answer never pairs the phone", () => {
    expect(open('/')).toEqual({ external: `${WEB}/` });
    expect(open('/go/pair?api=https%3A%2F%2Fapi.example&code=ABCD-EFGH')).toEqual({
      external: `${WEB}/go/pair?api=https%3A%2F%2Fapi.example&code=ABCD-EFGH`,
    });
  });

  it('never throws on a malformed escape or a dot-segment id', () => {
    expect(open('/deliverables?deliverable=%E0%A4%A')).toEqual({ app: routes.cc.deliverables });
    expect(open('/chat?chatId=..')).toEqual({ app: routes.home });
    expect(open('/command-center?tab=board&task_id=42&question=.')).toEqual({
      app: routes.cc.ticket(42),
    });
  });
});

describe('parseQuery', () => {
  it('keeps the first value of a repeated name and reads + as a space', () => {
    const query = parseQuery('tab=board&tab=questions&q=a+b&flag');
    expect(query.get('tab')).toBe('board');
    expect(query.get('q')).toBe('a b');
    expect(query.get('flag')).toBe('');
    expect(parseQuery('').size).toBe(0);
  });
});

describe('studioUrl', () => {
  it('is the web URL and the path, or null without a web URL or for a non-path', () => {
    expect(studioUrl('/settings', WEB)).toBe(`${WEB}/settings`);
    expect(studioUrl('/settings', '  ')).toBeNull();
    expect(studioUrl('//evil.example', WEB)).toBeNull();
  });
});

describe("Studio is the current server's (US-006d)", () => {
  it("opens a paired own server's Studio (its web_url) in the system browser", () => {
    currentServers.connected(RECORD);
    expect(studioUrl('/settings')).toBe(`${RECORD.webUrl}/settings`);
    expect(appRouteForWebLink(missionHref('m-7'))).toEqual({
      external: `${RECORD.webUrl}/missions/m-7`,
    });
  });

  it("goes back to the built-in server's once the own server is forgotten (none in a test build)", () => {
    currentServers.connected(RECORD);
    currentServers.forgotten();
    expect(studioUrl('/settings')).toBeNull();
    expect(appRouteForWebLink(missionHref('m-7'))).toBeNull();
  });
});
