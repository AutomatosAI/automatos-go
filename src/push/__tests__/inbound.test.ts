// Reading a notification (US-015b): what expo-notifications hands over on iOS and Android → one
// event or 'unreadable' (never a throw); the event, the verify answer and the session → one intent,
// where an unverified payload does nothing for every action and only 'reply', 'open' and the tap
// exist; each response's key remembered once, keys only, at most HANDLED_KEYS_MAX.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ANSWER_MAX_CHARS, DEFAULT_ACTION_ID, HANDLED_KEYS_MAX } from '../config';
import {
  handledKeysFrom,
  responseKey,
  storedHandledKeys,
  wasHandled,
  withHandled,
} from '../inbound/dedupe';
import { answerTextOf, intentFor, type IntentInput } from '../inbound/intent';
import { fromNotification, fromResponse, type InboundEvent } from '../inbound/parse';
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

function input(
  overrides: Partial<IntentInput> & { action?: string | null; userText?: string | null },
) {
  const { action = 'reply', userText = 'Yes, ship it', ...rest } = overrides;
  return {
    event: { action, userText },
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
      action: 'reply',
      userText: '  Yes, ship it  ',
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.data)).toBe(true);
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
      notificationId: '1001',
      ticketNumber: '0419',
    });
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

describe('dedupe', () => {
  it('a response key is `${identifier}:${actionIdentifier}`', () => {
    const event = readable(iosResponse('reply', 'the reply'), fromResponse);
    expect(responseKey(event)).toBe(`${IOS_ID}:reply`);
    expect(responseKey({ id: IOS_ID, action: null })).toBe(`${IOS_ID}:`);
  });

  it(`is bounded at HANDLED_KEYS_MAX (${HANDLED_KEYS_MAX}), the oldest dropped, a new array each time`, () => {
    const keys = Array.from({ length: HANDLED_KEYS_MAX + 5 }, (_, n) => `id-${n}:open`).reduce(
      (list: readonly string[], key) => {
        const next = withHandled(list, key);
        expect(next).not.toBe(list);
        return next;
      },
      [],
    );
    expect(keys).toHaveLength(HANDLED_KEYS_MAX);
    expect(keys[0]).toBe('id-5:open');
    expect(wasHandled(keys, 'id-4:open')).toBe(false);
    expect(wasHandled(keys, `id-${HANDLED_KEYS_MAX + 4}:open`)).toBe(true);
  });

  it('a key handled again moves to the end, once', () => {
    expect(withHandled(['a:open', 'b:open'], 'a:open')).toEqual(['b:open', 'a:open']);
  });

  it('the stored form holds the keys and nothing else, and reads back', () => {
    const event = readable(iosResponse('reply', 'my secret reply'), fromResponse);
    const stored = storedHandledKeys(withHandled([], responseKey(event)));
    expect(JSON.parse(stored)).toEqual([`${IOS_ID}:reply`]);
    for (const text of ['my secret reply', 'Ship the Lisbon deck?', FULL.sig, 'Later']) {
      expect(stored).not.toContain(text);
    }
    expect(handledKeysFrom(stored)).toEqual([`${IOS_ID}:reply`]);
  });

  it.each([[null], [undefined], [''], ['{bad'], ['{"a":1}'], ['"key"']])(
    'stored %j reads as no keys',
    (stored) => {
      expect(handledKeysFrom(stored)).toEqual([]);
    },
  );

  it('reads back strings only, at most HANDLED_KEYS_MAX', () => {
    const many = Array.from({ length: HANDLED_KEYS_MAX + 3 }, (_, n) => `k${n}:open`);
    expect(handledKeysFrom(JSON.stringify(['a:open', 1, null, 'b:open']))).toEqual([
      'a:open',
      'b:open',
    ]);
    expect(handledKeysFrom(JSON.stringify(many))).toEqual(many.slice(-HANDLED_KEYS_MAX));
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
    const keys = deepFreeze(['x:open']);
    intentFor(deepFreeze({ ...input({ userText: event.userText }), payload }));
    withHandled(keys, responseKey(event));
    expect([response, ios]).toEqual(snapshot);
    expect(keys).toEqual(['x:open']);
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
