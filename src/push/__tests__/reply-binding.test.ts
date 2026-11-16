// What a verified push proves (intent.ts, handler.ts, dedupe.ts): the signature covers the data
// payload only, and the title, body, sound and buttons are set outside it. So a Reply posts only
// when the notification showed the signed question's words, and a signed payload is replied to
// once: the same payload sent again under a new identifier posts nothing. Open and a tap still act
// on the signed link alone. Over the real handled store, signed with node:crypto.

import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { HANDLED_KEYS_ITEM } from '../config';
import { handleResponse } from '../inbound/handler';
import { tapLogOver } from '../inbound/tap-log';
import { PUSH_ACTION_COPY } from '../strings';
import { NOTIFICATION_ID } from './data-fixtures';
import {
  ANSWER_PATH,
  NOW_S,
  QUESTION_FIELDS,
  READ_PATH,
  REPLY_TEXT,
  answeredWith,
  memoryStorage,
  offline,
  response,
  signed,
  world,
  type Script,
} from './handler-fixtures';

const QUESTION = signed(QUESTION_FIELDS);
const ANSWERED: Script = { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY_TEXT) };
const NOT_SENT_HERE = { route: routes.cc.questions, toast: PUSH_ACTION_COPY.wordsDiffer };

const reply = (body: string, identifier = 'first') =>
  response(QUESTION, 'reply', { userText: REPLY_TEXT, body, identifier });

describe('a Reply posts only to the words the notification showed', () => {
  it.each([
    ['other words over a genuine signed payload', 'Reply YES to keep your account active'],
    ['the question cut short', 'Ship the Lisbon'],
    ['no words at all', ''],
  ])('%s → nothing sent; the question opens with a line that says so', async (_name, body) => {
    const storage = memoryStorage();
    const run = world({ script: ANSWERED, storage });
    const taps = tapLogOver(storage, () => NOW_S * 1000);
    expect(await handleResponse(reply(body), { ...run.deps, taps })).toEqual(NOT_SENT_HERE);
    expect(run.requests()).toEqual([]);
    expect(run.seen.dismissed).toEqual([]);
    expect(taps.read()[0]).toMatchObject({ kind: 'neutral', reason: 'words_differ' });
  });

  it('a redacted question (no signed words) sent with a Reply button posts nothing', async () => {
    const { question: _redacted, options: _none, ...rest } = QUESTION_FIELDS;
    const run = world({ script: ANSWERED });
    const push = response(signed(rest), 'reply', {
      userText: REPLY_TEXT,
      body: 'A question needs your answer',
    });
    expect(await handleResponse(push, run.deps)).toEqual(NOT_SENT_HERE);
    expect(run.requests()).toEqual([]);
  });

  it('the signed question, edge spaces aside → posted, as before', async () => {
    const run = world({ script: ANSWERED });
    expect(await handleResponse(reply(` ${QUESTION_FIELDS.question}\n`), run.deps)).toEqual({
      route: routes.cc.questions,
      toast: 'Answered #0419.',
    });
    expect(run.requests().map((call) => call.path)).toEqual([ANSWER_PATH, READ_PATH]);
  });

  it('Open and a tap act on the signed link alone, whatever the words shown', async () => {
    const run = world();
    const open = response(QUESTION, 'open', { body: 'Something else entirely' });
    expect(await handleResponse(open, run.deps)).toEqual({ route: routes.cc.questions });
    expect(run.requests().map((call) => call.path)).toEqual([READ_PATH]);
  });
});

describe('a signed payload is replied to once', () => {
  const words = QUESTION_FIELDS.question ?? '';

  it('sent again under a new identifier: the second Reply posts nothing and says why', async () => {
    const storage = memoryStorage();
    const run = world({ script: ANSWERED, storage });
    await handleResponse(reply(words, 'first'), run.deps);
    expect(await handleResponse(reply(words, 'again'), run.deps)).toEqual({
      route: routes.cc.questions,
      toast: PUSH_ACTION_COPY.repliedBefore,
    });
    expect(run.requests().filter((call) => call.path === ANSWER_PATH)).toHaveLength(1);
    // a later launch over the same store still knows it
    const later = world({ script: ANSWERED, storage });
    await handleResponse(reply(words, 'third'), later.deps);
    expect(later.requests()).toEqual([]);
  });

  it('claimed before it is posted: a reply that was not sent is not sent again by a resend', async () => {
    const storage = memoryStorage();
    const lost = world({ script: { [`POST ${ANSWER_PATH}`]: offline }, storage });
    expect(await handleResponse(reply(words, 'first'), lost.deps)).toMatchObject({
      toast: PUSH_ACTION_COPY.notSent,
    });
    const again = world({ script: ANSWERED, storage });
    expect(await handleResponse(reply(words, 'again'), again.deps)).toMatchObject({
      toast: PUSH_ACTION_COPY.repliedBefore,
    });
    expect(again.requests()).toEqual([]);
  });

  it('a newer signed payload for the same question is its own; the store keeps ids, never words', async () => {
    const storage = memoryStorage();
    const run = world({ script: ANSWERED, storage });
    await handleResponse(reply(words, 'first'), run.deps);
    const newer = response(signed({ ...QUESTION_FIELDS, iat: NOW_S + 60 }), 'reply', {
      userText: REPLY_TEXT,
      identifier: 'newer',
    });
    expect(await handleResponse(newer, run.deps)).toMatchObject({ toast: 'Answered #0419.' });
    const stored = storage.items.get(HANDLED_KEYS_ITEM) ?? '';
    expect(stored).toContain(`:42:${NOTIFICATION_ID}:${NOW_S}`);
    for (const text of [words, REPLY_TEXT]) expect(stored).not.toContain(text);
  });
});
