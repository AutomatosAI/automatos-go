// Links the OS hands the app (P001N-SEAM-3; the app standard's rule 5.2): an iOS universal link,
// an Android App Link or an automatos:// link becomes a route through web-links.ts's one table,
// through expo-router's redirectSystemPath in app/+native-intent.tsx, and what it carries is checked
// before anything opens. Nothing goes on as it came in a release build: a link the table cannot map
// opens Lost. The native-intent file is read from the source: it only delegates.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from '../../../app/+native-intent';
import { RECORD } from '../../connect/__tests__/paired-record';
import { currentServers } from '../../connect/current-server';
import { pairLinkFromParams, parsePairLink } from '../../connect/pair-link';
import { APP_IDENTITY } from '../../release/__tests__/settings/identity';
import { walkFiles } from '../../release/__tests__/support/tree';
import { ID_MAX_LENGTH, chatWithTicket, routes, type RouteParams } from '../routes';
import { APP_LINK_HOST, LINK_MAX_LENGTH, appPathForSystemLink } from '../web-links';

const WEB = `https://${APP_LINK_HOST}`;
const API = 'https://api.home.example';
const CODE = 'ABCD-EFGH';
const PAIR_QUERY = `api=${encodeURIComponent(API)}&code=${CODE}`;
const PAIR_ROUTE = routes.pairLinkWith({ apiOrigin: API, code: CODE });

const ROOT = path.resolve(__dirname, '../../..');
const nativeIntent = readFileSync(path.join(ROOT, 'app/+native-intent.tsx'), 'utf8');

/** The file's code: comment lines dropped. */
const nativeIntentCode = nativeIntent
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');

/** A release build's answer (vitest defines no __DEV__, so the default is a release build's too). */
const open = (link: string) => appPathForSystemLink(link, false);

/** The params expo-router hands a screen for a route: its query string, as useLocalSearchParams. */
function paramsOf(route: string): RouteParams {
  return Object.fromEntries(new URLSearchParams(route.split('?')[1] ?? ''));
}

describe('appPathForSystemLink: a web link opens the screen it means', () => {
  it('opens a conversation link on that conversation, not an empty draft', () => {
    expect(open(`${WEB}/chat?chatId=abc`)).toBe('/chat/abc');
    expect(open('/chat?chatId=abc')).toBe(routes.chat('abc'));
  });

  it('opens a ticket link on that ticket, not Lost', () => {
    expect(open(`${WEB}/command-center?tab=board&task_id=419`)).toBe(routes.cc.ticket(419));
    expect(open('/command-center?tab=board&task_id=419&question=g-9')).toBe(
      routes.cc.ticket(419, 'g-9'),
    );
  });

  it('maps the other web pages the phone has, exactly as a link inside the app does', () => {
    expect(open(`${WEB}/chat?ticket=419`)).toBe(chatWithTicket(419));
    expect(open(`${WEB}/command-center?tab=questions`)).toBe(routes.cc.questions);
    expect(open(`${WEB}/command-center`)).toBe(routes.cc.board);
    expect(open(`${WEB}/chat`)).toBe(routes.home);
  });

  it('reads the scheme and host in any case, the https port, a trailing slash and a fragment', () => {
    expect(open(`HTTPS://${APP_LINK_HOST.toUpperCase()}/chat?chatId=abc`)).toBe('/chat/abc');
    expect(open(`${WEB}:443/chat/?chatId=abc#top`)).toBe('/chat/abc');
    expect(open(`  ${WEB}/chat?chatId=abc  `)).toBe('/chat/abc');
  });

  it('maps an automatos:// link by the same table', () => {
    expect(open('automatos://chat?chatId=abc')).toBe('/chat/abc');
    expect(open('automatos:///command-center?tab=calendar')).toBe(routes.cc.calendar);
    expect(open('AUTOMATOS://deliverables')).toBe(routes.cc.deliverables);
  });

  it("opens the app's root (the address the router launches the app at) at home", () => {
    for (const link of ['automatos:///', 'automatos://', '/', `${WEB}/`, WEB]) {
      expect(open(link)).toBe(routes.home);
    }
  });
});

describe('appPathForSystemLink: the pairing link opens its screen once it reads as one', () => {
  it('opens the pairing screen with the server and the code, from https, automatos:// or a path', () => {
    for (const link of [
      `${WEB}/go/pair?${PAIR_QUERY}`,
      `automatos://go/pair?${PAIR_QUERY}`,
      `/go/pair/?${PAIR_QUERY}&extra=1#x`,
    ]) {
      expect(open(link)).toBe(PAIR_ROUTE);
    }
    expect(PAIR_ROUTE).toBe(`/go/pair?api=${encodeURIComponent(API)}&code=${CODE}`);
  });

  it('hands the pairing screen what it reads back as the same link', () => {
    const insecure = `api=${encodeURIComponent('http://192.168.1.20:8000')}&code=abcd-efgh`;
    for (const query of [PAIR_QUERY, insecure]) {
      const link = `automatos://go/pair?${query}`;
      expect(parsePairLink(link)).not.toBeNull();
      expect(parsePairLink(pairLinkFromParams(paramsOf(open(link))))).toEqual(parsePairLink(link));
    }
  });

  it('opens the bare pairing screen (which says the link cannot be used) for a broken one', () => {
    for (const query of [
      `api=${encodeURIComponent(API)}`,
      `api=${encodeURIComponent('http://api.example.com')}&code=${CODE}`,
      `api=javascript%3Aalert(1)&code=${CODE}`,
      `api=${encodeURIComponent(`${API}/a/../b`)}&code=${CODE}`,
    ]) {
      expect(open(`${WEB}/go/pair?${query}`)).toBe(routes.pairLink);
    }
    expect(parsePairLink(pairLinkFromParams(paramsOf(routes.pairLink)))).toBeNull();
  });

  it('opens Lost for any other /go path', () => {
    for (const link of [`${WEB}/go`, `${WEB}/go/`, '/go/anything/else?x=1']) {
      expect(open(link)).toBe(routes.lost);
    }
  });
});

describe('appPathForSystemLink: a crafted link opens no screen the table does not name', () => {
  it('opens Lost, never the screen, for an app path or a page the table has no entry for', () => {
    for (const link of [
      'automatos://settings',
      'automatos://cc/ticket/1',
      'automatos://chat/abc',
      'automatos://notifications',
      'automatos://voice?chat=abc',
      `automatos://connect?origin=${encodeURIComponent('https://evil.example')}&code=${CODE}`,
      'automatos://sign-in',
      `${WEB}/chat/abc`,
      `${WEB}/cc/deliverables/9b1c`,
      `${WEB}/agents?agent=a-1`,
      `${WEB}/command-center?tab=activity`,
      '/settings',
      '/missions/m-7',
      'automatos://nowhere',
    ]) {
      expect(open(link)).toBe(routes.lost);
    }
  });

  it("opens Lost for a development client's address in a release build", () => {
    for (const link of [
      'automatos://expo-development-client/?url=http%3A%2F%2F10.0.0.2%3A8081',
      'exp+automatos-go://expo-development-client/?url=https%3A%2F%2Fevil.example%2Fsettings',
      'automatos://10.0.0.2:8081/settings',
    ]) {
      expect(open(link)).toBe(routes.lost);
      expect(appPathForSystemLink(link)).toBe(routes.lost);
    }
  });

  it('lets only a development build pass a link the table cannot map on as it came', () => {
    const client = 'exp+automatos-go://expo-development-client/?url=http%3A%2F%2F10.0.0.2%3A8081';
    expect(appPathForSystemLink(client, true)).toBe(client);
    expect(appPathForSystemLink(`${WEB}/chat?chatId=abc`, true)).toBe('/chat/abc');
    expect(appPathForSystemLink(`automatos://${'a'.repeat(LINK_MAX_LENGTH)}`, true)).toBe(
      routes.lost,
    );
  });

  it('opens Lost for a scheme but https and automatos, or a host app.json does not claim', () => {
    for (const link of [
      `http://${APP_LINK_HOST}/chat?chatId=abc`,
      'https://evil.example/chat?chatId=abc',
      `https://${APP_LINK_HOST}.evil.example/chat?chatId=abc`,
      `https://evil.example@${APP_LINK_HOST}/chat?chatId=abc`,
      `https://${APP_LINK_HOST}@evil.example/chat?chatId=abc`,
      `https://${APP_LINK_HOST}:8443/chat?chatId=abc`,
      `${WEB}//evil.example/chat?chatId=abc`,
      'javascript:alert(1)',
      'intent://chat?chatId=abc#Intent;scheme=automatos;end',
      'file:///chat?chatId=abc',
      'data:text/html,<p>',
      'automatos:chat?chatId=abc',
      'chat?chatId=abc',
    ]) {
      expect(open(link)).toBe(routes.lost);
    }
  });
});

describe('appPathForSystemLink: what a link carries is checked before anything opens', () => {
  it('never puts an id with a slash, a dot segment, a space or a control character in a route', () => {
    for (const chatId of [
      '..',
      'a%2F..%2F..%2Fsettings',
      '..%2Fsettings',
      'a%2Fb',
      'a%20b',
      'a%00b',
      'a%0Ab',
      '%25',
      'a%3Fb',
      'a%23b',
      'a'.repeat(ID_MAX_LENGTH + 1),
    ]) {
      expect(open(`${WEB}/chat?chatId=${chatId}`)).toBe(routes.home);
    }
    expect(open(`${WEB}/chat?chatId=${'a'.repeat(ID_MAX_LENGTH)}`)).toBe(
      routes.chat('a'.repeat(ID_MAX_LENGTH)),
    );
    expect(open('/deliverables?deliverable=..%2F..%2Fx')).toBe(routes.cc.deliverables);
    expect(open('/command-center?task_id=42&question=a%2Fb')).toBe(routes.cc.ticket(42));
    expect(open('/command-center?task_id=42%2F1')).toBe(routes.cc.board);
  });

  it(`opens Lost, without reading it, for a link longer than ${LINK_MAX_LENGTH} characters`, () => {
    const base = `${WEB}/chat?chatId=abc&pad=`;
    const longest = `${base}${'a'.repeat(LINK_MAX_LENGTH - base.length)}`;
    expect(longest).toHaveLength(LINK_MAX_LENGTH);
    expect(open(longest)).toBe('/chat/abc');
    expect(open(`${longest}a`)).toBe(routes.lost);
    expect(open(`${PAIR_ROUTE}&pad=${'a'.repeat(LINK_MAX_LENGTH)}`)).toBe(routes.lost);
  });

  it('reads a long run of slashes once (a trimming pattern would read it again from each)', () => {
    const slashes = '/'.repeat(LINK_MAX_LENGTH - 40);
    const started = performance.now();
    expect(open(`${WEB}/chat${slashes}?chatId=abc`)).toBe('/chat/abc');
    expect(open(`${WEB}/chat${slashes}x`)).toBe(routes.lost);
    expect(open(`${WEB}/${'/'.repeat(500_000)}x`)).toBe(routes.lost);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("reads no server state: a paired own server's Studio is not opened either", () => {
    currentServers.connected(RECORD);
    try {
      expect(open(`${WEB}/agents?agent=a-1`)).toBe(routes.lost);
      expect(open(`${WEB}/chat?chatId=abc`)).toBe('/chat/abc');
    } finally {
      currentServers.forgotten();
    }
  });

  it('opens Lost for a malformed link, or one that is not text at all, and never throws', () => {
    for (const link of ['', '   ', `${WEB}/chat?chatId=a b`, '%E0%A4%A', `${WEB}/chat\u0000`]) {
      expect(open(link)).toBe(routes.lost);
    }
    for (const value of [undefined, null, 42, {}]) {
      const given = value as unknown as string;
      expect(() => appPathForSystemLink(given, true)).not.toThrow();
      expect(appPathForSystemLink(given, true)).toBe(routes.lost);
    }
  });
});

describe('the addresses the table trusts', () => {
  it("is the host app.json claims (the audits' identity), and no other", () => {
    expect(APP_LINK_HOST).toBe(APP_IDENTITY.links.applinks);
  });

  it('opens Lost on a path no screen file can take: the router names no other file with a +', () => {
    expect(routes.lost).toBe('/+not-found');
    const plus = walkFiles('app').filter((file) => path.basename(file).startsWith('+'));
    expect(plus.sort()).toEqual(['app/+native-intent.tsx', 'app/+not-found.tsx']);
  });
});

describe('app/+native-intent.tsx: redirectSystemPath only delegates', () => {
  it('maps the link expo-router hands it, at launch and while running', () => {
    expect(redirectSystemPath({ path: `${WEB}/chat?chatId=abc`, initial: true })).toBe('/chat/abc');
    expect(
      redirectSystemPath({ path: `${WEB}/command-center?tab=board&task_id=419`, initial: false }),
    ).toBe(routes.cc.ticket(419));
    expect(redirectSystemPath({ path: `automatos://go/pair?${PAIR_QUERY}`, initial: true })).toBe(
      PAIR_ROUTE,
    );
    expect(redirectSystemPath({ path: 'automatos:///', initial: true })).toBe(routes.home);
    expect(redirectSystemPath({ path: 'automatos://settings', initial: false })).toBe(routes.lost);
  });

  it("imports only web-links.ts's helper (and expo-router's type) and calls it with the path", () => {
    const imports = nativeIntentCode.match(/^import .+$/gm) ?? [];
    expect(imports).toEqual([
      "import type { NativeIntent } from 'expo-router';",
      "import { appPathForSystemLink } from '../src/navigation/web-links';",
    ]);
    expect(nativeIntentCode).toMatch(/=> *\n? *appPathForSystemLink\(path\);/);
  });

  it('has no logic of its own: no branch, no pattern, no try, no other export', () => {
    expect(nativeIntentCode).not.toMatch(
      /\b(if|else|switch|try|catch|for|while|new|RegExp|function)\b|\?|&&|\|\|/,
    );
    expect(nativeIntentCode.match(/^export /gm)).toEqual(['export ']);
    expect(nativeIntentCode).toContain('export const redirectSystemPath');
  });
});
