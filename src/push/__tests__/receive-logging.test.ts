// The foreground handler logs kinds only (US-014g, D-WRITES, KP18): for a verified, an unverified
// and an unreadable notification — and when the keychain, the refresh or the route read fails —
// whose title, body, question, each option and sig are distinctive strings, no logged argument
// (stringified) carries any of them, the push key or the Expo token.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleIncoming, type IncomingDeps } from '../inbound/receive';
import {
  EXPO_TOKEN,
  NOW_S,
  ORIGIN,
  OTHER_KEY,
  PHONE_KEY,
  QUESTION_FIELDS,
  nodeSha256,
  phoneRecord,
  received,
  signed,
  spyOnLogger,
} from './handler-fixtures';

const TITLE = 'Title-rx41-harbour';
const BODY = 'Body-rx42-lantern';
const QUESTION_TEXT = 'Question-rx43-which venue for the Porto offsite?';
const OPTIONS = ['Option-rx44-ribeira', 'Option-rx45-foz', 'Option-rx46-matosinhos'];

const FIELDS = { ...QUESTION_FIELDS, question: QUESTION_TEXT, options: OPTIONS };
const VERIFIED = signed(FIELDS);
const FORGED = signed(FIELDS, OTHER_KEY);
const text = { title: TITLE, body: BODY };

const SECRETS = [
  TITLE,
  BODY,
  QUESTION_TEXT,
  ...OPTIONS,
  VERIFIED.sig,
  FORGED.sig,
  PHONE_KEY,
  EXPO_TOKEN,
  'ExponentPushToken',
];

type Failing = Readonly<{ load?: boolean; refresh?: boolean; route?: boolean }>;

function deps(failing: Failing = {}): IncomingDeps {
  return {
    session: { serverOrigin: ORIGIN },
    store: {
      load: async () => {
        if (failing.load) throw new Error(`the keychain is locked for ${PHONE_KEY}`);
        return phoneRecord();
      },
    },
    sha256: nodeSha256,
    nowSeconds: () => NOW_S,
    currentRoute: () => {
      if (failing.route) throw new Error(`no route for ${QUESTION_TEXT}`);
      return '/';
    },
    refresh: () => {
      if (failing.refresh) throw new Error(`refresh failed after ${TITLE}`);
    },
  };
}

const CASES: readonly (readonly [string, unknown, Failing])[] = [
  ['verified', received(VERIFIED, 'automatos.question.3', text), {}],
  ['unverified', received(FORGED, 'automatos.question.3', text), {}],
  [
    'unreadable',
    { request: { identifier: 'x', content: { ...text, data: `${QUESTION_TEXT} ${OPTIONS[0]}` } } },
    {},
  ],
  ['keychain refused', received(VERIFIED, 'automatos.question.3', text), { load: true }],
  [
    'refresh and route failing',
    received(VERIFIED, 'automatos.question.3', text),
    { refresh: true, route: true },
  ],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the foreground handler logs kinds only', () => {
  it.each(CASES)(
    '%s: no title, body, question, option, sig, key or token',
    async (_name, notification, failing) => {
      const lines = spyOnLogger();
      await handleIncoming(notification, deps(failing));
      expect(lines.length).toBeGreaterThan(0);
      const logged = lines.join('\n');
      expect(SECRETS.filter((secret) => logged.includes(secret))).toEqual([]);
    },
  );
});
