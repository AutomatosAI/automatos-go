// The tap diagnostics (fix/notification-taps: never lose the evidence again): every handled
// response leaves ONE entry — kind, reason, link type, time — in a ring of the last 10 in MMKV,
// never the payload, the key, the sig, a title or a reply; the handler records open, answer,
// neutral (with why an unverified push failed its check), unhandled (a repeat) and error (a
// handler that failed, a router that refused); Settings → Notifications says each in plain words.

import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { DEFAULT_ACTION_ID, TAP_LOG_ITEM, TAP_LOG_MAX } from '../config';
import { handleResponse, type HandlerDeps } from '../inbound/handler';
import {
  linkTypeWord,
  tapEntryOf,
  tapLogOver,
  tapsFrom,
  withTap,
  type TapEntry,
} from '../inbound/tap-log';
import { tapRows } from '../settings/taps-view';
import { NOTIFICATION_ID, WS } from './data-fixtures';
import {
  ANSWER_PATH,
  NOW_S,
  OTHER_KEY,
  PHONE_KEY,
  QUESTION_FIELDS,
  REPLY_TEXT,
  REVIEW_FIELDS,
  answeredWith,
  memoryStorage,
  response,
  signed,
  world,
  type WorldOptions,
} from './handler-fixtures';

const AT = NOW_S * 1000;

function logged(options: WorldOptions = {}) {
  const storage = memoryStorage();
  const taps = tapLogOver(storage, () => AT);
  const run = world(options);
  const deps: HandlerDeps = { ...run.deps, taps };
  return { run, deps, taps, storage };
}

const tap = (data: unknown) => response(data, DEFAULT_ACTION_ID);

describe('the ring', () => {
  const entry = (n: number): TapEntry => tapEntryOf({ kind: 'open', reason: 'screen' }, n);

  it('keeps the newest first, at most TAP_LOG_MAX, in a new array', () => {
    let entries: readonly TapEntry[] = [];
    for (let n = 1; n <= TAP_LOG_MAX + 3; n += 1) entries = withTap(entries, entry(n));
    expect(entries).toHaveLength(TAP_LOG_MAX);
    expect(entries[0]?.at).toBe(TAP_LOG_MAX + 3);
    expect(entries.at(-1)?.at).toBe(4);
    const before = entries;
    expect(withTap(before, entry(99))).not.toBe(before);
    expect(before[0]?.at).toBe(TAP_LOG_MAX + 3);
  });

  it('reads back only what fits; anything else is none', () => {
    const good = entry(5);
    expect(tapsFrom(JSON.stringify([good, { kind: 'boom' }, 'x']))).toEqual([good]);
    expect(tapsFrom('not json')).toEqual([]);
    expect(tapsFrom(null)).toEqual([]);
    expect(tapsFrom(JSON.stringify({ kind: 'open' }))).toEqual([]);
  });

  it('names a known link type as it is, any other as "other", none as null', () => {
    expect(linkTypeWord('task')).toBe('task');
    expect(linkTypeWord('approval_grant')).toBe('approval_grant');
    expect(linkTypeWord('<script>')).toBe('other');
    expect(linkTypeWord('')).toBeNull();
    expect(linkTypeWord(undefined)).toBeNull();
  });

  it('cuts a long word and never keeps more than the fields it names', () => {
    const made = tapEntryOf(
      { kind: 'neutral', reason: 'x'.repeat(80), detail: 'mismatch', linkType: 'chat' },
      AT,
    );
    expect(made.reason).toHaveLength(32);
    expect(Object.keys(made).sort()).toEqual(['at', 'detail', 'kind', 'linkType', 'reason']);
  });

  it('a store that fails reads as none and never throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('mmkv');
      },
      setItem: () => {
        throw new Error('mmkv');
      },
      removeItem: () => {
        throw new Error('mmkv');
      },
    };
    const log = tapLogOver(broken, () => AT);
    expect(() => log.record({ kind: 'open' })).not.toThrow();
    expect(log.read()).toEqual([]);
    expect(() => log.clear()).not.toThrow();
  });
});

describe('the handler records one entry per response', () => {
  it('a verified tap that opened its screen', async () => {
    const { deps, taps } = logged();
    await handleResponse(tap(signed(REVIEW_FIELDS)), deps);
    expect(taps.read()).toEqual([
      { kind: 'open', reason: 'screen', detail: null, linkType: 'task', at: AT },
    ]);
  });

  it('a tap that opened the inbox (no screen for its link)', async () => {
    const { deps, taps } = logged();
    const push = signed({ ...REVIEW_FIELDS, link_type: 'playbook', link_id: '5' });
    await handleResponse(tap(push), deps);
    expect(taps.read()[0]).toMatchObject({ kind: 'open', reason: 'inbox', linkType: 'other' });
  });

  it('an unverified tap, with what the check found', async () => {
    const { deps, taps } = logged();
    await handleResponse(tap(signed(REVIEW_FIELDS, OTHER_KEY)), deps);
    expect(taps.read()[0]).toEqual({
      kind: 'neutral',
      reason: 'unverified',
      detail: 'mismatch',
      linkType: 'task',
      at: AT,
    });
    const none = logged({ record: null });
    await handleResponse(tap(signed(REVIEW_FIELDS, PHONE_KEY)), none.deps);
    expect(none.taps.read()[0]).toMatchObject({ reason: 'unverified', detail: 'no_record' });
  });

  it('another workspace, an unreadable response, a repeat', async () => {
    const other = logged({ workspaceId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' });
    await handleResponse(tap(signed(REVIEW_FIELDS)), other.deps);
    expect(other.taps.read()[0]).toMatchObject({ kind: 'neutral', reason: 'other_workspace' });

    const { deps, taps } = logged();
    await handleResponse({ notification: null }, deps);
    const push = tap(signed(REVIEW_FIELDS));
    await handleResponse(push, deps);
    await handleResponse(push, deps);
    expect(taps.read().map((entry) => [entry.kind, entry.reason])).toEqual([
      ['unhandled', 'repeat'],
      ['open', 'screen'],
      ['neutral', 'unreadable'],
    ]);
  });

  it('an answer from the notification, by the server’s verdict', async () => {
    const { deps, taps } = logged({
      script: { [`POST ${ANSWER_PATH}`]: answeredWith(REPLY_TEXT) },
    });
    await handleResponse(
      response(signed(QUESTION_FIELDS), 'reply', { userText: REPLY_TEXT }),
      deps,
    );
    expect(taps.read()[0]).toMatchObject({
      kind: 'answer',
      reason: 'answered',
      linkType: 'question',
    });
  });

  it('a router that refuses the screen is an error, with what was decided', async () => {
    const { deps, taps } = logged({ navigateFails: true });
    const outcome = await handleResponse(tap(signed(REVIEW_FIELDS)), deps);
    expect(outcome).toEqual({ route: routes.cc.ticket('8812') });
    expect(taps.read()[0]).toMatchObject({ kind: 'error', reason: 'navigate', detail: 'open' });
  });

  it('a handler that fails on its way is an error', async () => {
    const { deps, taps } = logged();
    const broken: HandlerDeps = {
      ...deps,
      session: {
        ...deps.session,
        workspaceId: () => {
          throw new Error('no workspace');
        },
      },
    };
    await handleResponse(tap(signed(REVIEW_FIELDS)), broken);
    expect(taps.read()[0]).toMatchObject({ kind: 'error', reason: 'failed' });
  });

  it('keeps nothing of the notification itself: no title, text, sig, key or ids', async () => {
    const { deps, storage } = logged();
    const push = signed({ ...QUESTION_FIELDS, question: 'Ship the Lisbon deck?' });
    await handleResponse(response(push, 'reply', { userText: 'secret words' }), deps);
    await handleResponse(tap(signed(REVIEW_FIELDS, OTHER_KEY)), deps);
    const stored = storage.items.get(TAP_LOG_ITEM) ?? '';
    for (const secret of [
      'Lisbon',
      'secret words',
      push.sig,
      PHONE_KEY,
      NOTIFICATION_ID,
      WS,
      '8812',
    ]) {
      expect(stored).not.toContain(secret);
    }
  });
});

describe('Settings → Notifications → Recent notification taps', () => {
  const now = new Date(AT + 2 * 60_000);
  const rows = (entries: readonly TapEntry[]) => tapRows(entries, now);

  it('says what happened, what it was about and when', () => {
    expect(
      rows([
        tapEntryOf({ kind: 'open', reason: 'screen', linkType: 'task' }, AT),
        tapEntryOf({ kind: 'open', reason: 'inbox', linkType: 'mission' }, AT),
        tapEntryOf(
          { kind: 'neutral', reason: 'unverified', detail: 'mismatch', linkType: 'chat' },
          AT,
        ),
        tapEntryOf({ kind: 'neutral', reason: 'unreadable' }, AT),
        tapEntryOf({ kind: 'unhandled', reason: 'repeat', linkType: 'question' }, AT),
        tapEntryOf({ kind: 'error', reason: 'navigate', detail: 'open' }, AT),
        tapEntryOf({ kind: 'answer', reason: 'already_answered', linkType: 'question' }, AT),
      ]).map((row) => [row.title, row.meta]),
    ).toEqual([
      ['Opened its screen', 'Ticket · 2 min'],
      ['Opened Notifications', 'Mission plan · 2 min'],
      ["Couldn't be checked: the phone's key does not match the server's", 'Chat · 2 min'],
      ["Couldn't be read", 'No link · 2 min'],
      ['Already handled', 'Question · 2 min'],
      ["The screen didn't open", 'No link · 2 min'],
      ['Already answered', 'Question · 2 min'],
    ]);
  });

  it('a record that had moved on says so; VoiceOver hears one line per tap', () => {
    const [row] = rows([
      tapEntryOf({ kind: 'open', reason: 'screen', detail: 'moved', linkType: 'chat' }, AT),
    ]);
    expect(row?.title).toBe('Opened its screen: it had moved on');
    expect(row?.accessibilityLabel).toBe('Opened its screen: it had moved on, Chat, 2 min');
  });

  it('a word this version does not know still reads as something', () => {
    const [row] = rows([
      { kind: 'neutral', reason: 'brand_new', detail: null, linkType: null, at: AT },
    ]);
    expect(row?.title).toBe('Something went wrong');
  });
});
