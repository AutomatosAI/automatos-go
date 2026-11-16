// What a link from outside may carry (the app standard's rule 5.2, web-links.ts): a cap on its
// query pairs, a cap on each value the table reads, no name the table reads given twice, ids taken
// exactly as they came (a padded one refused), and in a development build only the development
// client's own launch form passed on unmapped. Each cap is held at its boundary (one under, at,
// one over). And whatever arrives, a release build's answer is a route the table built or Lost:
// never an address with a scheme and never Expo Go's '/--/' form, which the router would read on.

import { describe, expect, it } from 'vitest';

import {
  GROWTH_FACTOR,
  LINEAR_GROWTH_LIMIT,
  growth,
  randomTexts,
} from '../../lib/__tests__/growth';
import { ID_MAX_LENGTH, routes } from '../routes';
import {
  APP_LINK_HOST,
  LINK_MAX_LENGTH,
  PARAM_VALUE_MAX_LENGTH,
  QUERY_PAIRS_MAX,
  appPathForSystemLink,
  appRouteForWebLink,
  readQuery,
} from '../web-links';

const WEB = `https://${APP_LINK_HOST}`;
const BUNDLER = encodeURIComponent('http://10.0.0.2:8081');

/** A release build's answer (vitest defines no __DEV__). */
const open = (link: string) => appPathForSystemLink(link, false);
const openInDevelopment = (link: string) => appPathForSystemLink(link, true);

/** A query of `count` pairs: chatId=abc, then names the table does not read. */
function pairs(count: number): string {
  return ['chatId=abc', ...Array.from({ length: count - 1 }, (_, at) => `x${at}=1`)].join('&');
}

describe(`a link's query holds ${QUERY_PAIRS_MAX} pairs at the most`, () => {
  it('maps one under and at the cap, and refuses one over', () => {
    expect(open(`${WEB}/chat?${pairs(QUERY_PAIRS_MAX - 1)}`)).toBe(routes.chat('abc'));
    expect(open(`${WEB}/chat?${pairs(QUERY_PAIRS_MAX)}`)).toBe(routes.chat('abc'));
    expect(open(`${WEB}/chat?${pairs(QUERY_PAIRS_MAX + 1)}`)).toBe(routes.lost);
    expect(appRouteForWebLink(`/chat?${pairs(QUERY_PAIRS_MAX + 1)}`, WEB)).toBeNull();
  });

  it(`refuses 50,000 pairs, counting them without reading one (under ${LINEAR_GROWTH_LIMIT}x for ${GROWTH_FACTOR}x)`, () => {
    expect(readQuery(pairs(50_000), ['chatId'])).toBeNull();
    const hostile = (size: number) => {
      const search = pairs(size);
      return () => readQuery(search, ['chatId']);
    };
    expect(growth(hostile, 50_000 / GROWTH_FACTOR)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});

describe(`each value the table reads is ${PARAM_VALUE_MAX_LENGTH} characters at the most`, () => {
  it('reads one under and at the cap, and refuses the link one over', () => {
    for (const length of [PARAM_VALUE_MAX_LENGTH - 1, PARAM_VALUE_MAX_LENGTH]) {
      expect(readQuery(`tab=${'a'.repeat(length)}`, ['tab'])?.get('tab')).toHaveLength(length);
    }
    expect(readQuery(`tab=${'a'.repeat(PARAM_VALUE_MAX_LENGTH + 1)}`, ['tab'])).toBeNull();
    // inside the app an unknown tab opens Studio; one over the cap opens nothing at all
    const tab = (length: number) => `/command-center?tab=${'a'.repeat(length)}`;
    expect(appRouteForWebLink(tab(PARAM_VALUE_MAX_LENGTH), WEB)).toEqual({
      external: `${WEB}${tab(PARAM_VALUE_MAX_LENGTH)}`,
    });
    expect(appRouteForWebLink(tab(PARAM_VALUE_MAX_LENGTH + 1), WEB)).toBeNull();
  });

  it('ignores the value of a name it does not read, however long', () => {
    expect(open(`${WEB}/chat?chatId=abc&x=${'a'.repeat(PARAM_VALUE_MAX_LENGTH + 1)}`)).toBe(
      routes.chat('abc'),
    );
  });

  it(`takes an id of ${ID_MAX_LENGTH} characters at the most (one under, at, one over)`, () => {
    for (const length of [ID_MAX_LENGTH - 1, ID_MAX_LENGTH]) {
      expect(open(`${WEB}/chat?chatId=${'a'.repeat(length)}`)).toBe(
        routes.chat('a'.repeat(length)),
      );
    }
    expect(open(`${WEB}/chat?chatId=${'a'.repeat(ID_MAX_LENGTH + 1)}`)).toBe(routes.home);
  });

  it(`reads a link of ${LINK_MAX_LENGTH} characters at the most (one under, at, one over)`, () => {
    const base = `${WEB}/chat?chatId=abc&pad=`;
    const sized = (length: number) => `${base}${'a'.repeat(length - base.length)}`;
    expect(open(sized(LINK_MAX_LENGTH - 1))).toBe(routes.chat('abc'));
    expect(open(sized(LINK_MAX_LENGTH))).toBe(routes.chat('abc'));
    expect(open(sized(LINK_MAX_LENGTH + 1))).toBe(routes.lost);
  });
});

describe('a name the table reads comes once', () => {
  it('refuses the link when one comes twice, written the same or escaped', () => {
    for (const link of [
      `${WEB}/chat?chatId=a&chatId=b`,
      `${WEB}/chat?chatId=abc&chat%49d=evil`,
      `${WEB}/chat?chatId=%E0%A4%A&chatId=abc`,
      `${WEB}/command-center?tab=board&tab=questions`,
      `${WEB}/command-center?task_id=1&task_id=2`,
      `${WEB}/deliverables?deliverable=d-1&deliverable=d-2`,
      `${WEB}/go/pair?api=${BUNDLER}&api=${BUNDLER}&code=ABCD-EFGH`,
      `${WEB}/go/pair?api=${BUNDLER}&code=ABCD-EFGH&code=WXYZ-2345`,
    ]) {
      expect(open(link)).toBe(routes.lost);
    }
    expect(appRouteForWebLink('/chat?chatId=a&chatId=b', WEB)).toBeNull();
  });

  it('ignores a name it does not read, repeated or not: the route is rebuilt from known names', () => {
    expect(open(`${WEB}/chat?chatId=abc&utm_source=a&utm_source=b`)).toBe(routes.chat('abc'));
    expect(open(`${WEB}/chat?ticket=419&runtime=1`)).toBe(routes.chatWithTicket(419));
  });

  it("reads '__proto__', 'constructor' and 'toString' as names it does not read", () => {
    for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(open(`${WEB}/chat?${name}=x&${name}=y&chatId=abc`)).toBe(routes.chat('abc'));
      expect(readQuery(`${name}=x`, ['chatId'])?.size).toBe(0);
    }
    expect(Object.getPrototypeOf(readQuery('__proto__=x', ['chatId']))).toBe(Map.prototype);
  });
});

describe('an id is taken exactly as it came', () => {
  it('refuses a padded id, never trims it: the entry opens as with no id', () => {
    expect(open(`${WEB}/chat?chatId=%20abc%20`)).toBe(routes.home);
    expect(open(`${WEB}/chat?chatId=+abc+`)).toBe(routes.home);
    expect(open(`${WEB}/chat?chatId=abc%0A`)).toBe(routes.home);
    expect(open(`${WEB}/chat?ticket=419%20`)).toBe(routes.home);
    expect(open(`${WEB}/command-center?task_id=%20419`)).toBe(routes.cc.board);
    expect(open(`${WEB}/command-center?task_id=419&question=%09g-9`)).toBe(routes.cc.ticket(419));
    expect(open(`${WEB}/deliverables?deliverable=%09d-1`)).toBe(routes.cc.deliverables);
  });

  it('refuses a double-encoded slash: decoded once, a percent sign is no part of an id', () => {
    expect(open(`${WEB}/chat?chatId=a%252Fb`)).toBe(routes.home);
    expect(open(`${WEB}/deliverables?deliverable=..%252F..%252Fsettings`)).toBe(
      routes.cc.deliverables,
    );
  });
});

describe("Expo Go's addresses open Lost in a release build", () => {
  it('opens Lost for exp://, exps:// and the /--/ form in any scheme or path', () => {
    for (const link of [
      'exp://10.0.0.2:8081',
      'exp://10.0.0.2:8081/--/chat?chatId=abc',
      'exps://u.expo.dev/project/--/settings',
      'exps://expo-development-client/?url=x',
      'automatos:///--/settings',
      `${WEB}/--/chat?chatId=abc`,
      '/--/chat?chatId=abc',
    ]) {
      expect(open(link)).toBe(routes.lost);
    }
  });
});

describe("a development build passes only the development client's own launch form", () => {
  it('passes the launch form, in any scheme, as it came', () => {
    for (const link of [
      `exp+automatos-go://expo-development-client/?url=${BUNDLER}`,
      `automatos://expo-development-client/?url=${BUNDLER}`,
      `exp://expo-development-client/?url=${BUNDLER}`,
      'EXP+AUTOMATOS-GO://EXPO-DEVELOPMENT-CLIENT',
    ]) {
      expect(openInDevelopment(link)).toBe(link);
      expect(open(link)).toBe(routes.lost);
    }
  });

  it('holds every other link to the table, the app scheme included', () => {
    for (const link of [
      'automatos://settings',
      'automatos://cc/ticket/1',
      'automatos://10.0.0.2:8081/',
      'exp://10.0.0.2:8081/--/settings',
      'https://evil.example/chat?chatId=abc',
      'automatos://expo-development-client.evil.example/?url=x',
      'automatos://evil.example/expo-development-client',
      'automatos://user@expo-development-client/?url=x',
      'automatos://expo-development-clients/',
    ]) {
      expect(openInDevelopment(link)).toBe(routes.lost);
    }
    expect(openInDevelopment(`${WEB}/chat?chatId=abc`)).toBe(routes.chat('abc'));
    expect(openInDevelopment('automatos:///')).toBe(routes.home);
  });
});

/** Links built from pieces an attacker would reach for, and short random ones. */
function hostileLinks(): readonly string[] {
  const schemes = [
    '',
    'exp://',
    'exps://',
    'EXP://',
    'exp+automatos-go://',
    'automatos://',
    'AUTOMATOS:///',
    `${WEB}`,
    'http://',
    'https://evil.example',
    'intent://',
    '//',
  ];
  const middles = [
    '',
    '/',
    '--/',
    '/--/',
    '10.0.0.2:8081/--/',
    'expo-development-client/?url=exp%3A%2F%2Fx',
    'chat',
    '/chat',
    'go/pair',
    '/go/pair',
    'command-center',
    'deliverables',
  ];
  const queries = [
    '',
    '?chatId=abc',
    '?chatId=exp://x',
    '?chatId=%2F--%2Fx',
    `?api=${BUNDLER}&code=ABCD-EFGH`,
    '?api=exp%3A%2F%2Fx&code=ABCD-EFGH',
    '?tab=board&task_id=1&question=--',
    '#/--/x',
  ];
  const built = schemes.flatMap((scheme) =>
    middles.flatMap((middle) => queries.map((query) => `${scheme}${middle}${query}`)),
  );
  return [...built, ...randomTexts('exp:/-?#=&a%2F+.', 4000, 24)];
}

describe('a release build answers a route the table built, or Lost, and nothing else', () => {
  it('never returns an address with a scheme, a doubled slash or the /--/ form', () => {
    for (const link of hostileLinks()) {
      for (const answer of [open(link), appPathForSystemLink(link)]) {
        expect(answer.startsWith('/') && !answer.startsWith('//'), link).toBe(true);
        expect(answer.includes('://') || answer.includes('/--/'), link).toBe(false);
        expect(/^exps?:/i.test(answer), link).toBe(false);
      }
    }
  });
});
