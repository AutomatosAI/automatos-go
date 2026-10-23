// Links the OS hands the app (P001N-SEAM-3): an iOS universal link or Android App Link to a web page
// the phone has a screen for opens that screen, by web-links.ts's own mapping, through expo-router's
// redirectSystemPath in app/+native-intent.tsx; /go/*, automatos:// and anything unmapped go on as
// they came, and nothing throws. The native-intent file is read from the source: it only delegates.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from '../../../app/+native-intent';
import { RECORD } from '../../connect/__tests__/paired-record';
import { currentServers } from '../../connect/current-server';
import { chatWithTicket, routes } from '../routes';
import { appPathForSystemLink } from '../web-links';

const WEB = 'https://ui.automatos.app';
const PAIR_QUERY = 'api=https%3A%2F%2Fapi.home.example&code=ABCD-EFGH';

const ROOT = path.resolve(__dirname, '../../..');
const nativeIntent = readFileSync(path.join(ROOT, 'app/+native-intent.tsx'), 'utf8');

/** The file's code: comment lines dropped. */
const nativeIntentCode = nativeIntent
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');

describe('appPathForSystemLink: a web link opens the screen it means', () => {
  it('opens a conversation link on that conversation, not an empty draft', () => {
    expect(appPathForSystemLink(`${WEB}/chat?chatId=abc`)).toBe('/chat/abc');
    expect(appPathForSystemLink('/chat?chatId=abc')).toBe(routes.chat('abc'));
  });

  it('opens a ticket link on that ticket, not Lost', () => {
    expect(appPathForSystemLink(`${WEB}/command-center?tab=board&task_id=419`)).toBe(
      routes.cc.ticket(419),
    );
    expect(appPathForSystemLink('/command-center?tab=board&task_id=419&question=g-9')).toBe(
      routes.cc.ticket(419, 'g-9'),
    );
  });

  it('maps the other web pages the phone has, exactly as a link inside the app does', () => {
    expect(appPathForSystemLink(`${WEB}/chat?ticket=419`)).toBe(chatWithTicket(419));
    expect(appPathForSystemLink(`${WEB}/command-center?tab=questions`)).toBe(routes.cc.questions);
    expect(appPathForSystemLink(`${WEB}/command-center`)).toBe(routes.cc.board);
    expect(appPathForSystemLink(`${WEB}/chat`)).toBe(routes.home);
  });

  it('reads the scheme in any case, a port, a trailing slash and a fragment', () => {
    expect(appPathForSystemLink('HTTPS://ui.automatos.app/chat?chatId=abc')).toBe('/chat/abc');
    expect(appPathForSystemLink(`${WEB}:443/chat/?chatId=abc#top`)).toBe('/chat/abc');
    expect(appPathForSystemLink(`  ${WEB}/chat?chatId=abc  `)).toBe('/chat/abc');
  });
});

describe('appPathForSystemLink: the pairing link and app-scheme links go on unchanged', () => {
  it('passes /go/pair and every /go/* path through, as https and as a bare path', () => {
    for (const link of [
      `${WEB}/go/pair?${PAIR_QUERY}`,
      `/go/pair?${PAIR_QUERY}`,
      `${WEB}/go`,
      `${WEB}/go/`,
      '/go/anything/else?x=1',
    ]) {
      expect(appPathForSystemLink(link)).toBe(link);
    }
  });

  it('passes automatos:// links through', () => {
    for (const link of [
      'automatos://connect',
      `automatos://go/pair?${PAIR_QUERY}`,
      'automatos:///',
    ]) {
      expect(appPathForSystemLink(link)).toBe(link);
    }
  });
});

describe("appPathForSystemLink: a page it cannot map keeps today's behaviour", () => {
  it('leaves a page with no screen here as it came: no Studio, no browser from here', () => {
    for (const link of [
      `${WEB}/agents?agent=a-1`,
      `${WEB}/command-center?tab=activity`,
      `${WEB}/chat/abc`,
      WEB,
      '/missions/m-7',
    ]) {
      expect(appPathForSystemLink(link)).toBe(link);
    }
  });

  it("reads no server state: a paired own server's Studio is not opened either", () => {
    currentServers.connected(RECORD);
    try {
      expect(appPathForSystemLink(`${WEB}/agents?agent=a-1`)).toBe(`${WEB}/agents?agent=a-1`);
      expect(appPathForSystemLink(`${WEB}/chat?chatId=abc`)).toBe('/chat/abc');
    } finally {
      currentServers.forgotten();
    }
  });

  it('leaves a malformed or unknown link unchanged and never throws', () => {
    for (const link of [
      '',
      '   ',
      `${WEB}//evil.example/chat?chatId=abc`,
      `${WEB}/chat?chatId=a b`,
      'http://ui.automatos.app/chat?chatId=abc',
      'javascript:alert(1)',
      'chat?chatId=abc',
      '%E0%A4%A',
    ]) {
      expect(appPathForSystemLink(link)).toBe(link);
    }
  });

  it('hands back whatever it was given when that is not text at all', () => {
    for (const value of [undefined, null, 42]) {
      const given = value as unknown as string;
      expect(() => appPathForSystemLink(given)).not.toThrow();
      expect(appPathForSystemLink(given)).toBe(given);
    }
  });
});

describe('app/+native-intent.tsx: redirectSystemPath only delegates', () => {
  it('maps the link expo-router hands it, at launch and while running', () => {
    expect(redirectSystemPath({ path: `${WEB}/chat?chatId=abc`, initial: true })).toBe('/chat/abc');
    expect(
      redirectSystemPath({ path: `${WEB}/command-center?tab=board&task_id=419`, initial: false }),
    ).toBe(routes.cc.ticket(419));
    expect(redirectSystemPath({ path: `automatos://go/pair?${PAIR_QUERY}`, initial: true })).toBe(
      `automatos://go/pair?${PAIR_QUERY}`,
    );
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
