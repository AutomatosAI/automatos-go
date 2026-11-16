// A Reply under an agent's title (confirm-sender.ts): before it posts, the question its signed
// grant_id names is read from the open questions the Questions screen lists, with the person's own
// sign-in, and it posts only when the server still has it open, its words are the signed ones and
// the title names the agent the server says asked. Every other answer, and every failure of the
// read, opens the question with nothing posted. The read chooses its question by the signed id,
// never by anything the notification shows. Over the real route (staleChecksFor) on the
// foundation's fake transport.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonReply } from '../../api/__tests__/fake-transport';
import { routes } from '../../navigation/routes';
import { PUSH_TITLE_SEPARATOR as SEP, STALE_CHECK_TIMEOUT_MS } from '../config';
import { sameWords, senderVerdict, titleNames } from '../inbound/confirm-sender';
import { handleResponse } from '../inbound/handler';
import { staleChecksFor } from '../links/stale';
import { PUSH_ACTION_COPY, PUSH_LINK_COPY } from '../strings';
import {
  ANSWER_PATH,
  ASKER,
  QUESTION_FIELDS,
  READ_PATH,
  REPLY_TEXT,
  answeredWith,
  offline,
  refusedWith,
  response,
  signed,
  world,
  type Script,
} from './handler-fixtures';

const QUESTION = signed(QUESTION_FIELDS);
const WORDS = QUESTION_FIELDS.question ?? '';
const LIST = 'GET /api/v1/approval-grants';
const AGENT_TITLE = `${ASKER}${SEP}AI`;

afterEach(() => vi.useRealTimers());

type Grant = Readonly<Record<string, unknown>>;

/** A grant as the list route answers it: the signed question, open, asked by ASKER. */
function grant(overrides: Grant = {}): Grant {
  return {
    id: 42,
    status: 'pending',
    question_md: WORDS,
    owner: { agent: { id: 5, name: ASKER }, ticket: null },
    ...overrides,
  };
}

const listing =
  (...grants: Grant[]) =>
  () =>
    jsonReply(200, { grants });

/** The handler over the real question read, the server answering from `script`. */
function overRoute(script: Script) {
  const run = world({ script: { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY_TEXT), ...script } });
  const deps = { ...run.deps, checks: staleChecksFor(run.deps.client) };
  const paths = () => run.requests().map((call) => `${call.method} ${call.path}`);
  return { run, deps, paths };
}

const reply = (title: string) =>
  response(QUESTION, 'reply', { userText: REPLY_TEXT, body: WORDS, title });

const inTheApp = (toast: string) => ({ route: routes.cc.questions, toast });

describe('a named agent’s question: read first, then posted', () => {
  it.each(['AI', 'IA', 'KI'])(
    'its own title (%s): read by the signed id, then posted',
    async (badge) => {
      const { deps, run, paths } = overRoute({ [LIST]: listing(grant()) });
      expect(await handleResponse(reply(`${ASKER}${SEP}${badge}`), deps)).toEqual({
        route: routes.cc.questions,
        toast: 'Answered #0419.',
      });
      expect(paths()).toEqual([LIST, `POST ${ANSWER_PATH}`, `POST ${READ_PATH}`]);
      const [read] = run.requests();
      expect(Object.fromEntries(read?.query ?? [])).toEqual({
        status: 'pending',
        kind: 'question',
      });
    },
  );

  it('the words on the server with their markdown marks still match', async () => {
    const marked = grant({ question_md: '**Ship** the _Lisbon_\n\n deck?' });
    const { deps } = overRoute({ [LIST]: listing(marked) });
    expect(await handleResponse(reply(AGENT_TITLE), deps)).toMatchObject({
      toast: 'Answered #0419.',
    });
  });
});

describe('nothing is posted unless the server confirms it all', () => {
  it('a title naming another sender', async () => {
    const { deps, paths } = overRoute({ [LIST]: listing(grant()) });
    expect(await handleResponse(reply(`Finance Bot${SEP}AI`), deps)).toEqual(
      inTheApp(PUSH_ACTION_COPY.senderUnchecked),
    );
    expect(paths()).toEqual([LIST]);
  });

  it.each([
    ['not among the open questions', listing(grant({ id: 7 }))],
    ['answered', listing(grant({ status: 'granted' }))],
  ])('a question the server says is %s: it says so', async (_name, answer) => {
    const { deps, paths } = overRoute({ [LIST]: answer });
    expect(await handleResponse(reply(AGENT_TITLE), deps)).toEqual(
      inTheApp(PUSH_LINK_COPY.questionGone),
    );
    expect(paths()).toEqual([LIST]);
  });

  it.each([
    ['other words', 'Delete the production branch?'],
    ['the same words behind a link', '[Ship](https://example.test) the Lisbon deck?'],
  ])('%s on the server', async (_name, words) => {
    const { deps, paths } = overRoute({ [LIST]: listing(grant({ question_md: words })) });
    expect(await handleResponse(reply(AGENT_TITLE), deps)).toEqual(
      inTheApp(PUSH_ACTION_COPY.wordsDiffer),
    );
    expect(paths()).toEqual([LIST]);
  });

  it('no asker named by the server', async () => {
    const { deps } = overRoute({ [LIST]: listing(grant({ owner: null })) });
    expect(await handleResponse(reply(AGENT_TITLE), deps)).toEqual(
      inTheApp(PUSH_ACTION_COPY.senderUnchecked),
    );
  });
});

describe('a read that fails posts nothing and opens the question', () => {
  it.each([
    ['no network', offline],
    ['a 403 (this person may not list questions)', refusedWith(403, 'Admin only')],
    ['a 404', refusedWith(404, 'Not Found')],
    ['a 500', refusedWith(500, 'boom')],
    ['an answer that is not the list', () => jsonReply(200, { nope: true })],
  ])('%s', async (_name, answer) => {
    const { deps, paths } = overRoute({ [LIST]: answer });
    expect(await handleResponse(reply(AGENT_TITLE), deps)).toEqual(
      inTheApp(PUSH_ACTION_COPY.notSent),
    );
    expect(paths()).toEqual([LIST]);
  });

  it(`no answer within STALE_CHECK_TIMEOUT_MS (${STALE_CHECK_TIMEOUT_MS} ms)`, async () => {
    const { deps, run, paths } = overRoute({ [LIST]: () => new Promise(() => undefined) });
    vi.useFakeTimers();
    const handled = handleResponse(reply(AGENT_TITLE), deps);
    await vi.advanceTimersByTimeAsync(STALE_CHECK_TIMEOUT_MS);
    expect(await handled).toEqual(inTheApp(PUSH_ACTION_COPY.notSent));
    expect(paths()).toEqual([LIST]);
    expect(run.requests()).toHaveLength(1);
  });
});

describe('the read is chosen by the signed id, never by what the notification shows', () => {
  it('another open question asked by the sender the title names is never the one checked', async () => {
    const decoy = grant({ id: 7, owner: { agent: { id: 9, name: 'Finance Bot' }, ticket: null } });
    const { deps, run, paths } = overRoute({ [LIST]: listing(grant(), decoy) });
    expect(await handleResponse(reply(`Finance Bot${SEP}AI`), deps)).toEqual(
      inTheApp(PUSH_ACTION_COPY.senderUnchecked),
    );
    expect(paths()).toEqual([LIST]);
    expect(run.requests()[0]?.query.toString()).toBe('status=pending&kind=question');
  });

  it('the signed question gone, a decoy open under that sender: closed, nothing posted', async () => {
    const decoy = grant({ id: 7, owner: { agent: { id: 9, name: 'Finance Bot' }, ticket: null } });
    const { deps } = overRoute({ [LIST]: listing(decoy) });
    expect(await handleResponse(reply(`Finance Bot${SEP}AI`), deps)).toEqual(
      inTheApp(PUSH_LINK_COPY.questionGone),
    );
  });

  it('Auto’s own title needs no read', async () => {
    const { deps, paths } = overRoute({});
    await handleResponse(reply(`Auto${SEP}AI`), deps);
    expect(paths()).toEqual([`POST ${ANSWER_PATH}`, `POST ${READ_PATH}`]);
  });
});

describe('the pure checks', () => {
  it('sameWords: marks and spaces aside; never empty, a link or a cut question', () => {
    expect(sameWords('# Ship  the\n- `Lisbon` ~~deck~~?', 'Ship the Lisbon deck?')).toBe(true);
    expect(sameWords('Ship the Lisbon deck?', 'Ship the Lisbon deck…')).toBe(false);
    expect(sameWords('', '')).toBe(false);
  });

  it('titleNames: exactly "{asker} · {badge}"; no asker names nothing', () => {
    expect(titleNames(` ${ASKER}${SEP}KI `, ` ${ASKER} `)).toBe(true);
    expect(titleNames(`${ASKER}${SEP}AI!`, ASKER)).toBe(false);
    expect(titleNames(`${SEP}AI`, '')).toBe(false);
    expect(titleNames(AGENT_TITLE, null)).toBe(false);
  });

  it('senderVerdict: closed, then words, then sender', () => {
    const confirm = { title: AGENT_TITLE, question: WORDS };
    expect(senderVerdict(null, confirm)).toBe('question_closed');
    const asked = { open: true, words: WORDS, asker: ASKER };
    expect(senderVerdict({ ...asked, open: false }, confirm)).toBe('question_closed');
    expect(senderVerdict({ ...asked, words: 'Other' }, confirm)).toBe('words_differ');
    expect(senderVerdict({ ...asked, asker: 'Someone' }, confirm)).toBe('sender_unchecked');
    expect(senderVerdict(asked, confirm)).toBe('confirmed');
  });
});
