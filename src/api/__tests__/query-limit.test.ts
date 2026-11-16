// A limit is not asked again by a remount or a return to the front until it lifts (review of the
// template's copies, 16 Nov). The retry rule never retries a limit, but the query library asks
// again on every mount of a query in error with no data (retryOnMount), and on a return to the
// front for a stale one (refetchOnWindowFocus): run on the app's own QueryClient in node, a screen
// holding the query is an observer subscribed to it, as src/api/__tests__/app-focus.test.ts does.

import { focusManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../errors';
import { createQueryClient, LIMIT_UNKNOWN_WAIT_MS, limitHolds } from '../query-client';
import { queryKeys } from '../query-keys';
import { flush } from './fake-transport';

const KEY = queryKeys.board();
const START = Date.UTC(2026, 10, 16, 12, 0, 0);

let client: QueryClient | null = null;
let now = START;

afterEach(() => {
  now = START;
  client?.unmount();
  client?.clear();
  client = null;
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
});

function mountedClient(): QueryClient {
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const made = createQueryClient();
  made.mount();
  client = made;
  return made;
}

/** A screen that holds the Board while mounted; the server answers each ask with `answer`. */
function screen(made: QueryClient, answer: () => Promise<unknown>) {
  let asked = 0;
  const mount = async () => {
    const observer = new QueryObserver(made, {
      queryKey: KEY,
      queryFn: () => {
        asked += 1;
        return answer();
      },
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await flush();
    return unsubscribe;
  };
  return { mount, asked: () => asked };
}

const limited = (retryAt: number | null) => () =>
  Promise.reject(new ApiError('limit', { status: 429, retryAt }));

describe('a screen that remounts during a limit', () => {
  it('asks nothing inside the wait its retryAt names, and once after it', async () => {
    const made = mountedClient();
    const board = screen(made, limited(START + 120_000));
    (await board.mount())();
    expect(board.asked()).toBe(1);
    now = START + 60_000;
    (await board.mount())();
    (await board.mount())();
    expect(board.asked()).toBe(1);
    now = START + 120_001;
    (await board.mount())();
    expect(board.asked()).toBe(2);
  });

  it('waits a short fixed time when the limit named none', async () => {
    const made = mountedClient();
    const board = screen(made, limited(null));
    (await board.mount())();
    now = START + LIMIT_UNKNOWN_WAIT_MS - 1;
    (await board.mount())();
    expect(board.asked()).toBe(1);
    now = START + LIMIT_UNKNOWN_WAIT_MS + 1;
    (await board.mount())();
    expect(board.asked()).toBe(2);
  });

  it('a failure that is not a limit is asked again on a remount, as before', async () => {
    const made = mountedClient();
    const board = screen(made, () => Promise.reject(new ApiError('forbidden', { status: 403 })));
    (await board.mount())();
    (await board.mount())();
    expect(board.asked()).toBe(2);
  });
});

describe('a return to the front during a limit', () => {
  it('asks nothing for a held query in a limit, and asks once it has lifted', async () => {
    const made = mountedClient();
    let answer: () => Promise<unknown> = () => Promise.resolve({ tasks: [] });
    const board = screen(made, () => answer());
    const unmount = await board.mount();
    answer = limited(START + 120_000);
    now = START + 31_000; // stale
    await made.refetchQueries({ queryKey: KEY }).catch(() => undefined);
    expect(board.asked()).toBe(2);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();
    expect(board.asked()).toBe(2);
    now = START + 120_001;
    answer = () => Promise.resolve({ tasks: [] });
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();
    expect(board.asked()).toBe(3);
    unmount();
  });
});

describe('limitHolds', () => {
  it('is true only for a query whose last error is a limit not yet lifted', () => {
    const state = (error: unknown, status = 'error') => ({
      state: { status, error, errorUpdatedAt: START } as never,
    });
    expect(limitHolds(state(new ApiError('limit', { retryAt: START + 10 })), START)).toBe(true);
    expect(limitHolds(state(new ApiError('limit', { retryAt: START + 10 })), START + 10)).toBe(
      false,
    );
    expect(limitHolds(state(new ApiError('network')), START)).toBe(false);
    expect(limitHolds(state(new ApiError('limit'), 'success'), START)).toBe(false);
  });
});
