// A push received while the app is open (US-014g, KP15): it shows only once it verifies with this
// server's push key within FOREGROUND_VERIFY_TIMEOUT_MS; a verified one shows its banner and list
// entry (a sound for a question only), the banner left out when the person is already on its
// target, and refreshes exactly the needs-you and questions families. An unverified, timed-out,
// stale or unreadable push shows nothing and refreshes nothing. Never throws.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../api/query-keys';
import { FOREGROUND_VERIFY_TIMEOUT_MS, PUSH_SIG_MAX_AGE_SECONDS } from '../config';
import {
  PUSH_REFRESH_FAMILIES,
  handleIncoming,
  refreshAfterPush,
  type IncomingDeps,
} from '../inbound/receive';
import { SHOW_NOTHING } from '../platform/foreground';
import type { PushRecord } from '../registration/record';
import {
  NOW_S,
  ORIGIN,
  OTHER_KEY,
  QUESTION_FIELDS,
  REVIEW_FIELDS,
  nodeSha256,
  OPEN_CATEGORY,
  QUESTION_CATEGORY,
  phoneRecord,
  received,
  signed,
} from './handler-fixtures';

type Options = {
  readonly record?: PushRecord | null;
  readonly load?: () => Promise<PushRecord | null>;
  readonly route?: string | null;
  readonly refreshFails?: boolean;
  readonly routeFails?: boolean;
};

function incoming(options: Options = {}) {
  let refreshes = 0;
  const record = options.record === undefined ? phoneRecord() : options.record;
  const deps: IncomingDeps = {
    session: { serverOrigin: ORIGIN },
    store: { load: options.load ?? (async () => record) },
    sha256: nodeSha256,
    nowSeconds: () => NOW_S,
    currentRoute: () => {
      if (options.routeFails) throw new Error('no navigator yet');
      return options.route === undefined ? '/' : options.route;
    },
    refresh: () => {
      refreshes += 1;
      if (options.refreshFails) throw new Error('no query client');
    },
  };
  return { deps, refreshes: () => refreshes };
}

const SHOWN_WITH_SOUND = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};
const SHOWN_QUIETLY = { ...SHOWN_WITH_SOUND, shouldPlaySound: false };
const LIST_ONLY = { ...SHOWN_QUIETLY, shouldShowBanner: false };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a verified push shows and refreshes', () => {
  it('a question elsewhere in the app: banner, list and sound; one refresh', async () => {
    const run = incoming({ route: '/cc/board' });
    expect(await handleIncoming(received(signed(QUESTION_FIELDS)), run.deps)).toEqual(
      SHOWN_WITH_SOUND,
    );
    expect(run.refreshes()).toBe(1);
  });

  it('a review push: banner and list, no sound', async () => {
    const run = incoming({ route: '/' });
    const shown = await handleIncoming(received(signed(REVIEW_FIELDS), OPEN_CATEGORY), run.deps);
    expect(shown).toEqual(SHOWN_QUIETLY);
    expect(run.refreshes()).toBe(1);
  });

  it.each([
    ['a question on Questions', signed(QUESTION_FIELDS), QUESTION_CATEGORY, '/cc/questions'],
    ['a review push on its ticket', signed(REVIEW_FIELDS), OPEN_CATEGORY, '/cc/ticket/8812'],
  ])('%s: the list entry only, no banner and no sound', async (_name, data, category, route) => {
    const run = incoming({ route });
    expect(await handleIncoming(received(data, category), run.deps)).toEqual(LIST_ONLY);
    expect(run.refreshes()).toBe(1);
  });

  it('a refresh or a route read that fails still shows the push', async () => {
    const run = incoming({ refreshFails: true, routeFails: true });
    const shown = await handleIncoming(received(signed(QUESTION_FIELDS)), run.deps);
    expect(shown).toEqual(SHOWN_WITH_SOUND);
  });
});

describe('anything that does not verify shows nothing and refreshes nothing', () => {
  const stale = { ...QUESTION_FIELDS, iat: NOW_S - PUSH_SIG_MAX_AGE_SECONDS - 1 };
  it.each([
    ['signed with another key', received(signed(QUESTION_FIELDS, OTHER_KEY)), {}],
    ['a v1 payload', received(signed({ ...QUESTION_FIELDS, v: 1 })), {}],
    ['older than the window', received(signed(stale)), {}],
    ['no push record', received(signed(QUESTION_FIELDS)), { record: null }],
    [
      "another server's record",
      received(signed(QUESTION_FIELDS)),
      { record: phoneRecord({ serverOrigin: 'https://other.example.test' }) },
    ],
    [
      'a keychain that refuses',
      received(signed(QUESTION_FIELDS)),
      { load: () => Promise.reject(new Error('locked')) },
    ],
    ['data that is not a push', received({ hello: 'world' }), {}],
    ['no request at all', { date: 1 }, {}],
    ['not an object', 'push', {}],
  ])('%s', async (_name, notification, options: Options) => {
    const run = incoming(options);
    expect(await handleIncoming(notification, run.deps)).toEqual(SHOW_NOTHING);
    expect(run.refreshes()).toBe(0);
  });

  it(`a check slower than ${FOREGROUND_VERIFY_TIMEOUT_MS} ms counts as unverified`, async () => {
    vi.useFakeTimers();
    const run = incoming({ load: () => new Promise<PushRecord | null>(() => undefined) });
    const shown = handleIncoming(received(signed(QUESTION_FIELDS)), run.deps);
    await vi.advanceTimersByTimeAsync(FOREGROUND_VERIFY_TIMEOUT_MS);
    expect(await shown).toEqual(SHOW_NOTHING);
    expect(run.refreshes()).toBe(0);
  });
});

describe('refreshAfterPush', () => {
  it("marks exactly the foundation's needsYou and questions families stale", async () => {
    let predicate: ((query: { queryKey: readonly unknown[] }) => boolean) | undefined;
    const queryClient = {
      invalidateQueries: vi.fn(async (filters: { predicate?: typeof predicate }) => {
        predicate = filters.predicate;
      }),
    };
    refreshAfterPush(queryClient as never);
    await Promise.resolve();
    expect(PUSH_REFRESH_FAMILIES).toEqual(['needsYou', 'questions']);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    const hits = (queryKey: readonly unknown[]) => predicate?.({ queryKey }) ?? false;
    expect(hits(queryKeys.needsYou())).toBe(true);
    expect(hits(queryKeys.questions('pending', 'question'))).toBe(true);
    expect(hits(queryKeys.board())).toBe(false);
    expect(hits(queryKeys.ticket('8812'))).toBe(false);
  });
});
