// The action handler logs kinds and counts only (US-015d, D-WRITES, KP18): every handler path —
// a verified reply, an unverified reply, Open, neutral replies, a network failure, a 422, a 403 and
// an unreadable response — runs with a payload whose title, body, question, each option and sig are
// distinctive strings, and no logged argument (stringified) carries any of them, the reply, the push
// key or the Expo token. Nothing in src/push imports Sentry or adds a breadcrumb.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleResponse } from '../inbound/handler';
import { startResponses } from '../inbound/responses';
import {
  ANSWER_PATH,
  EXPO_TOKEN,
  OTHER_KEY,
  PHONE_KEY,
  QUESTION_FIELDS,
  answeredWith,
  offline,
  refusedWith,
  response,
  responsesPort,
  settle,
  signed,
  spyOnLogger,
  world,
  type WorldOptions,
} from './handler-fixtures';
import { importsOf, sources } from './source-files';

const TITLE = 'Title-zq81-lighthouse';
const BODY = 'Body-zq82-meridian';
const QUESTION_TEXT = 'Question-zq83-should we ship the Lisbon deck?';
const OPTIONS = ['Option-zq84-yes', 'Option-zq85-no', 'Option-zq86-later'];
const REPLY = 'Reply-zq87-ship it on Friday';

const FIELDS = { ...QUESTION_FIELDS, question: QUESTION_TEXT, options: OPTIONS };
const VERIFIED = signed(FIELDS);
const FORGED = signed(FIELDS, OTHER_KEY);

const text = { title: TITLE, body: BODY };

type Path = Readonly<{
  name: string;
  push: unknown;
  action: string;
  userText?: string;
  options?: WorldOptions;
}>;

const PATHS: readonly Path[] = [
  {
    name: 'verified reply',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { script: { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY) } },
  },
  { name: 'unverified reply', push: FORGED, action: 'reply', userText: REPLY },
  { name: 'open', push: VERIFIED, action: 'open' },
  {
    name: 'neutral: viewer',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { role: 'viewer' },
  },
  {
    name: 'neutral: another workspace',
    push: VERIFIED,
    action: 'open',
    options: { workspaceId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' },
  },
  {
    name: 'network failure',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { script: { [`POST ${ANSWER_PATH}`]: offline } },
  },
  {
    name: '422',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { script: { [`POST ${ANSWER_PATH}`]: refusedWith(422, `not open: ${REPLY}`) } },
  },
  {
    name: '403',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { script: { [`POST ${ANSWER_PATH}`]: refusedWith(403, 'Admin only') } },
  },
  {
    name: 'keychain refused',
    push: VERIFIED,
    action: 'reply',
    userText: REPLY,
    options: { loadFails: true },
  },
];

const SECRETS = [
  TITLE,
  BODY,
  QUESTION_TEXT,
  ...OPTIONS,
  VERIFIED.sig,
  FORGED.sig,
  REPLY,
  PHONE_KEY,
  EXPO_TOKEN,
  'ExponentPushToken',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the handler logs kinds only', () => {
  it.each(PATHS)(
    '$name: no title, body, question, option, sig, reply, key or token',
    async (path) => {
      const lines = spyOnLogger();
      const run = world(path.options);
      const userText = path.userText === undefined ? {} : { userText: path.userText };
      await handleResponse(response(path.push, path.action, { ...text, ...userText }), run.deps);
      expect(lines.length).toBeGreaterThan(0);
      const logged = lines.join('\n');
      expect(SECRETS.filter((secret) => logged.includes(secret))).toEqual([]);
    },
  );

  it('an unreadable response and the cold-start wiring log nothing of the payload', async () => {
    const lines = spyOnLogger();
    const run = world();
    await handleResponse({ notification: { request: { content: { title: TITLE } } } }, run.deps);
    const fake = responsesPort(response(VERIFIED, 'open', text));
    await startResponses({ ...run.deps, port: fake.port }).coldStart;
    fake.fire(response(FORGED, 'reply', { ...text, userText: REPLY, identifier: 'second' }));
    await settle();
    const logged = lines.join('\n');
    expect(SECRETS.filter((secret) => logged.includes(secret))).toEqual([]);
  });

  it('no file in src/push imports @sentry/react-native or calls addBreadcrumb', () => {
    const files = sources('src/push').filter(({ file }) => !file.includes('__tests__'));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter(({ text }) => importsOf(text, /^@sentry\//).length > 0 || /addBreadcrumb/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
