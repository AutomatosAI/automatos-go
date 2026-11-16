// Reading a notification (US-015b): what expo-notifications hands over on iOS and Android → one
// event or 'unreadable' (never a throw); the event, the verify answer and the session → one intent,
// where an unverified payload does nothing for every action and only 'reply', 'open' and the tap
// exist. The list of handled responses and its floor: dedupe.test.ts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ANSWER_MAX_CHARS, DEFAULT_ACTION_ID } from '../config';
import { NO_HANDLED_KEYS, responseKey, withHandled } from '../inbound/dedupe';
import { answerTextOf, intentFor, type IntentInput } from '../inbound/intent';
import {
  fromNotification,
  fromResponse,
  type InboundEvent,
  type ShownText,
} from '../inbound/parse';
import { parsePushData, type PushPayload } from '../schemas/payload';
import { FULL, MINIMAL, WS } from './data-fixtures';
import {
  ANDROID_ID,
  IOS_ID,
  androidResponse,
  deepFreeze,
  iosContent,
  iosResponse,
  responseWithContent,
} from './inbound-fixtures';

function readable(raw: unknown, read: (value: unknown) => ReturnType<typeof fromResponse>) {
  const event = read(raw);
  if (event.kind !== 'readable') throw new Error('expected a readable event');
  return event;
}

const QUESTION = parsePushData(FULL) as PushPayload;
const QUESTION_LINK = { link_type: 'question', link_id: '42' };

/** What the server's own question push shows: Auto's title and the signed question. */
const SHOWN: ShownText = Object.freeze({
  title: 'Auto · AI',
  subtitle: null,
  body: FULL.question,
  attachments: 0,
});

function input(
  overrides: Partial<IntentInput> & {
    action?: string | null;
    userText?: string | null;
    shown?: Partial<ShownText>;
  },
) {
  const { action = 'reply', userText = 'Yes, ship it', shown = {}, ...rest } = overrides;
  return {
    event: { action, userText, shown: { ...SHOWN, ...shown } },
    verified: true,
    payload: QUESTION,
    currentWorkspaceId: WS,
    role: 'editor' as const,
    ...rest,
  };
}

describe('fromResponse / fromNotification', () => {
  it('reads an iOS-shaped response', () => {
    const event = readable(iosResponse('reply', '  Yes, ship it  '), fromResponse);
    expect(event).toEqual({
      kind: 'readable',
      id: IOS_ID,
      category: 'automatos.question.3',
      data: FULL,
      shown: SHOWN,
      action: 'reply',
      userText: '  Yes, ship it  ',
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.data)).toBe(true);
  });

  it('reads what the notification showed; text that is not text is none, and it stays readable', () => {
    expect(readable(androidResponse(DEFAULT_ACTION_ID), fromResponse).shown).toEqual(SHOWN);
    for (const odd of [undefined, null, 42]) {
      const content = { ...iosContent(), title: odd, subtitle: odd, body: odd };
      const event = readable(responseWithContent(content), fromResponse);
      expect([event.shown, event.data]).toEqual([
        { title: null, subtitle: null, body: null, attachments: 0 },
        FULL,
      ]);
    }
    const shownWith = (attachments: unknown) =>
      readable(responseWithContent({ ...iosContent(), attachments }), fromResponse).shown;
    expect([shownWith([{ id: 'a' }, { id: 'b' }]), shownWith('odd')]).toMatchObject([
      { attachments: 2 },
      { attachments: 1 },
    ]);
  });

  it('reads an Android-shaped response: the Expo body still as dataString', () => {
    const event = readable(androidResponse(DEFAULT_ACTION_ID), fromResponse);
    expect(event).toMatchObject({ id: ANDROID_ID, action: DEFAULT_ACTION_ID, userText: null });
    expect(event.data).toEqual(FULL);
  });

  it('reads a JSON-string data body', () => {
    const event = readable(responseWithContent(iosContent(JSON.stringify(FULL))), fromResponse);
    expect(event.data).toEqual(FULL);
  });

  it('never reads dataString once data is mapped (expo-notifications makes it a warning getter)', () => {
    const content = iosContent();
    Object.defineProperty(content, 'dataString', {
      get() {
        throw new Error('dataString read');
      },
    });
    expect(readable(responseWithContent(content), fromResponse).data).toEqual(FULL);
  });

  it('reads a foreground notification with no action and no reply', () => {
    const response = iosResponse('reply') as { notification: unknown };
    const event = readable(response.notification, fromNotification);
    expect(event).toMatchObject({ id: IOS_ID, action: null, userText: null, data: FULL });
  });

  it('a payload that is not v2 is still an event: the signature check refuses it, not the parser', () => {
    const v1 = { ...FULL, v: 1 };
    const event = readable(responseWithContent(iosContent(v1)), fromResponse);
    expect(event.data).toEqual(v1);
    expect(parsePushData(event.data)).toBeNull();
  });

  const throwing = {
    get request() {
      throw new Error('native getter');
    },
  };

  it.each([
    ['null', null],
    ['a string', 'reply'],
    ['no notification', { actionIdentifier: 'reply' }],
    [
      'no actionIdentifier',
      { notification: (iosResponse('open') as { notification: unknown }).notification },
    ],
    ['an empty identifier', responseWithContent(iosContent(), '')],
    ['no data', responseWithContent({ categoryIdentifier: null })],
    ['empty data and no dataString', responseWithContent(iosContent({}))],
    ['data that is not JSON', responseWithContent(iosContent('{not json'))],
    ['data that is a JSON array', responseWithContent(iosContent('[1,2]'))],
    ['data that is a number', responseWithContent(iosContent(42))],
    [
      'a dataString that is not JSON',
      responseWithContent({ dataString: 'nope', categoryIdentifier: null }),
    ],
    ['a notification whose getter throws', { notification: throwing, actionIdentifier: 'open' }],
  ])('%s → unreadable, never a throw', (_label, raw) => {
    expect(fromResponse(raw)).toEqual({ kind: 'unreadable' });
  });

  it('a notification with no request, or a getter that throws → unreadable', () => {
    expect(fromNotification({})).toEqual({ kind: 'unreadable' });
    expect(fromNotification(throwing)).toEqual({ kind: 'unreadable' });
    expect(fromNotification(undefined)).toEqual({ kind: 'unreadable' });
  });
});

describe('intentFor', () => {
  it('a verified reply to a question → answer, trimmed, with the notification and ticket', () => {
    expect(intentFor(input({ userText: '  Yes, ship it \n' }))).toEqual({
      kind: 'answer',
      grantId: '42',
      answerText: 'Yes, ship it',
      once: `signed:${WS}:42:1001:${FULL.iat}`,
      notificationId: '1001',
      ticketNumber: '0419',
    });
  });

  it("a reply whose notification did not show the signed question's words → words_differ", () => {
    const differ = { kind: 'neutral', reason: 'words_differ', link: QUESTION_LINK };
    for (const body of ['Reply YES to keep your account', 'Ship the Lisbon deck', '', null]) {
      expect(intentFor(input({ shown: { body } }))).toEqual(differ);
    }
    const { question: _redacted, ...rest } = QUESTION;
    const generic = { body: 'A question needs your answer' };
    expect(intentFor(input({ payload: rest, shown: generic }))).toEqual(differ);
    expect(intentFor(input({ shown: { subtitle: 'Approve the payment?' } }))).toEqual(differ);
    expect(intentFor(input({ shown: { attachments: 1 } }))).toEqual(differ);
    expect(intentFor(input({ shown: { body: `  ${FULL.question}\n` } })).kind).toBe('answer');
    // Open and a tap act on the signed link only: the words shown never change where they go
    expect(intentFor(input({ action: 'open', shown: { body: 'Something else' } })).kind).toBe(
      'open',
    );
  });

  it('a reply under a title the phone cannot check carries it, for the server to confirm', () => {
    for (const title of ['Approve the payment?', 'Ops Agent · AI', 'Auto · AI!', 'Auto']) {
      expect(intentFor(input({ shown: { title } }))).toMatchObject({
        kind: 'answer',
        confirm: { title, question: FULL.question },
      });
    }
    for (const title of ['Auto · AI', 'Auto · IA', 'Auto · KI', ' Auto · AI ', '', null]) {
      const intent = intentFor(input({ shown: { title } }));
      expect([intent.kind, 'confirm' in intent]).toEqual(['answer', false]);
    }
    expect(intentFor(input({ action: 'open', shown: { title: 'Approve it' } })).kind).toBe('open');
  });

  it.each(['owner', 'admin', 'editor'] as const)('%s may answer', (role) => {
    expect(intentFor(input({ role })).kind).toBe('answer');
  });

  it.each(['reply', 'open', DEFAULT_ACTION_ID, 'approve', 'option.1', null])(
    'an unverified payload → neutral unverified for %s, no link',
    (action) => {
      expect(intentFor(input({ action, verified: false }))).toEqual({
        kind: 'neutral',
        reason: 'unverified',
      });
    },
  );

  it('no v2 payload is unverified even if a caller says verified', () => {
    expect(intentFor(input({ payload: null }))).toEqual({ kind: 'neutral', reason: 'unverified' });
  });

  it('another workspace, or none yet → neutral other_workspace, no link', () => {
    const other = { kind: 'neutral', reason: 'other_workspace' };
    expect(intentFor(input({ currentWorkspaceId: 'another-workspace' }))).toEqual(other);
    expect(intentFor(input({ currentWorkspaceId: null, action: 'open' }))).toEqual(other);
  });

  it("a viewer's reply, or a role not yet known → cannot_answer with the question as its link", () => {
    const cannot = { kind: 'neutral', reason: 'cannot_answer', link: QUESTION_LINK };
    expect(intentFor(input({ role: 'viewer' }))).toEqual(cannot);
    expect(intentFor(input({ role: null }))).toEqual(cannot);
  });

  it.each([['   \n\t'], [''], [null]])(
    'a blank reply (%j) → blank_reply with the question',
    (userText) => {
      expect(intentFor(input({ userText }))).toEqual({
        kind: 'neutral',
        reason: 'blank_reply',
        link: QUESTION_LINK,
      });
    },
  );

  it("'open' and the tap → open with the signed link and the notification id", () => {
    const open = { kind: 'open', link: QUESTION_LINK, notificationId: '1001' };
    expect(intentFor(input({ action: 'open' }))).toEqual(open);
    expect(intentFor(input({ action: DEFAULT_ACTION_ID }))).toEqual(open);
  });

  it('open on a payload with no link → an empty link (the caller goes home)', () => {
    const payload = parsePushData(MINIMAL);
    expect(intentFor(input({ action: 'open', payload }))).toEqual({ kind: 'open', link: {} });
  });

  it.each(['approve', 'option.1', 'option.2', 'expo.modules.notifications.actions.DISMISS', null])(
    'any other identifier (%s) → neutral unknown',
    (action) => {
      expect(intentFor(input({ action }))).toEqual({ kind: 'neutral', reason: 'unknown' });
    },
  );

  it('a reply to a push that is not a signed question answers nothing', () => {
    const task = parsePushData({ ...FULL, link_type: 'task', link_id: '7' });
    const noGrant = parsePushData({ ...FULL, grant_id: '' });
    expect(intentFor(input({ payload: task }))).toEqual({ kind: 'neutral', reason: 'unknown' });
    expect(intentFor(input({ payload: noGrant }))).toEqual({ kind: 'neutral', reason: 'unknown' });
  });

  it("a signed field sent as '' is absent", () => {
    const payload = parsePushData({ ...FULL, notification_id: '', ticket_number: '', link_id: '' });
    expect(intentFor(input({ payload }))).toEqual({
      kind: 'answer',
      grantId: '42',
      answerText: 'Yes, ship it',
      once: `signed:${WS}:42::${FULL.iat}`,
    });
    expect(intentFor(input({ payload, action: 'open' }))).toEqual({
      kind: 'open',
      link: { link_type: 'question' },
    });
  });

  it(`cuts a reply to ANSWER_MAX_CHARS (${ANSWER_MAX_CHARS}) code points, never half a pair`, () => {
    expect(answerTextOf('a'.repeat(ANSWER_MAX_CHARS + 10))).toHaveLength(ANSWER_MAX_CHARS);
    const astral = '😀'.repeat(ANSWER_MAX_CHARS + 1);
    expect(Array.from(answerTextOf(astral))).toHaveLength(ANSWER_MAX_CHARS);
    expect(answerTextOf(`${'a'.repeat(ANSWER_MAX_CHARS - 1)} tail`)).toBe(
      'a'.repeat(ANSWER_MAX_CHARS - 1),
    );
  });
});

describe('purity', () => {
  it('deep-frozen inputs are read, never changed', () => {
    const response = deepFreeze(androidResponse('reply', ' ok '));
    const ios = deepFreeze(iosResponse('open'));
    const snapshot = structuredClone([response, ios]);
    const event = readable(response, fromResponse) as InboundEvent;
    readable(ios, fromResponse);
    const payload = deepFreeze(parsePushData(event.data));
    const keys = deepFreeze(withHandled(NO_HANDLED_KEYS, 'x:open', 1));
    intentFor(deepFreeze({ ...input({ userText: event.userText }), payload }));
    withHandled(keys, responseKey(event), 2);
    expect([response, ios]).toEqual(snapshot);
    expect(keys).toEqual({ entries: [{ key: 'x:open', signedAt: 1 }], floor: null });
  });

  it("DEFAULT_ACTION_ID is the installed expo-notifications' DEFAULT_ACTION_IDENTIFIER", () => {
    const typings = readFileSync(
      resolve(
        __dirname,
        '../../../node_modules/expo-notifications/build/NotificationsEmitter.d.ts',
      ),
      'utf8',
    );
    expect(typings).toContain(`DEFAULT_ACTION_IDENTIFIER = "${DEFAULT_ACTION_ID}"`);
  });
});
