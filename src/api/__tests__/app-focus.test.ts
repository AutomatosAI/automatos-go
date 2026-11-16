// TanStack's focus over AppState (app-focus.ts, rule 6.4), run on the app's own QueryClient
// (createQueryClient: its stale time and retry policy) in node, with an AppState the test drives as
// the phone does: iOS says 'inactive' on the way out and over a system sheet, 'background' once
// away, and 'active' at the front. A screen holding a query is an observer subscribed to it.

import { focusManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readRepoFile } from '../../release/__tests__/support/tree';
import { followAppFocus, judgedFrom, returnedToFront } from '../app-focus';
import { createApiClient } from '../client';
import { createLiveController, isForeground } from '../live-connection';
import { createLiveHub } from '../live-events';
import { clearQueryCache, createQueryClient, QUERY_STALE_TIME_MS } from '../query-client';
import { queryKeys } from '../query-keys';
import { fakeAppState } from './fake-app-state';
import { SERVER, fakeTransport, flush, hangUntilAborted } from './fake-transport';

type Board = { readonly tasks: readonly string[] };

const HELD: Board = Object.freeze({ tasks: ['held'] });
const FRESH: Board = Object.freeze({ tasks: ['fresh'] });
const KEY = queryKeys.board();
/** Read longer ago than the app's stale time: a screen holding it should ask again. */
const OLD_MS = QUERY_STALE_TIME_MS + 1_000;
const WS = '7f1c2a54-0000-4000-8000-000000000001';

let mounted: QueryClient | null = null;

/** The app's client, mounted as QueryClientProvider mounts it, with focus following `app`. */
function wired(initial = 'active') {
  const app = fakeAppState(initial);
  followAppFocus(app.source);
  const client = createQueryClient();
  client.mount();
  mounted = client;
  return { app, client };
}

afterEach(() => {
  mounted?.unmount();
  mounted?.clear();
  mounted = null;
  focusManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
});

/** The Board held by a screen, read `ageMs` ago; each question to the server is counted. */
function heldBoard(client: QueryClient, ageMs: number, answer: () => Promise<Board>) {
  let asked = 0;
  client.setQueryData(KEY, HELD);
  const observer = new QueryObserver<Board>(client, {
    queryKey: KEY,
    queryFn: () => {
      asked += 1;
      return answer();
    },
  });
  observer.subscribe(() => undefined);
  client.setQueryData(KEY, HELD, { updatedAt: Date.now() - ageMs });
  return { observer, asked: () => asked };
}

const answers = (board: Board) => () => Promise.resolve(board);

/** An answer the test lets through when it chooses: a request still in flight until then. */
function heldAnswer() {
  let release: (board: Board) => void = () => undefined;
  const answer = () =>
    new Promise<Board>((resolve) => {
      release = resolve;
    });
  return { answer, release: (board: Board) => release(board) };
}

describe('returnedToFront: only a real return counts', () => {
  it('the background (or an iOS extension) to active is a return', () => {
    expect(returnedToFront('background', 'active')).toBe(true);
    expect(returnedToFront('extension', 'active')).toBe(true);
  });

  it('the launch, before any status, to active is a return', () => {
    expect(returnedToFront(null, 'active')).toBe(true);
    expect(returnedToFront('unknown', 'active')).toBe(true);
  });

  it('inactive to active is a system sheet closing over an app that never left', () => {
    expect(returnedToFront('inactive', 'active')).toBe(false);
    expect(returnedToFront('active', 'active')).toBe(false);
  });

  it('nothing but active is a return', () => {
    expect(returnedToFront('background', 'inactive')).toBe(false);
    expect(returnedToFront('active', 'background')).toBe(false);
    expect(returnedToFront('background', 'background')).toBe(false);
  });

  it('a passing inactive keeps where the app was', () => {
    expect(judgedFrom('background', 'inactive')).toBe('background');
    expect(judgedFrom('active', 'inactive')).toBe('active');
    expect(judgedFrom(null, 'inactive')).toBeNull();
    expect(judgedFrom('inactive', 'background')).toBe('background');
  });
});

describe('a held query when the app comes back to the front', () => {
  it('a stale one asks the server again, and the fresh answer replaces it', async () => {
    const { app, client } = wired();
    const board = heldBoard(client, OLD_MS, answers(FRESH));
    app.go('inactive', 'background');
    expect(focusManager.isFocused()).toBe(false);
    app.go('active');
    await flush();
    expect(board.asked()).toBe(1);
    expect(board.observer.getCurrentResult().data).toEqual(FRESH);
  });

  it('a fresh one asks nothing', async () => {
    const { app, client } = wired();
    const board = heldBoard(client, 0, answers(FRESH));
    app.go('inactive', 'background', 'active');
    await flush();
    expect(board.asked()).toBe(0);
  });

  it('an inactive flip (a permission prompt, Face ID, the app switcher) asks nothing', async () => {
    const { app, client } = wired();
    const board = heldBoard(client, OLD_MS, answers(FRESH));
    app.go('inactive', 'active', 'inactive', 'active');
    await flush();
    expect(board.asked()).toBe(0);
    expect(focusManager.isFocused()).toBe(true);
  });

  it('back from the background through an inactive step is still a return', async () => {
    const { app, client } = wired();
    const board = heldBoard(client, OLD_MS, answers(FRESH));
    app.go('background', 'inactive', 'active');
    await flush();
    expect(board.asked()).toBe(1);
  });

  it('a failed refresh keeps what the screen holds and sets the flag the line reads', async () => {
    const { app, client } = wired();
    const board = heldBoard(client, OLD_MS, () => Promise.reject(new Error('no answer')));
    app.go('background', 'active');
    await flush();
    const result = board.observer.getCurrentResult();
    expect(board.asked()).toBe(1);
    expect(result.data).toEqual(HELD);
    expect(result.isRefetchError).toBe(true);
  });

  it('a query no screen holds, and a disabled one, are not asked', async () => {
    const { app, client } = wired();
    let asked = 0;
    const count = () => {
      asked += 1;
      return Promise.resolve(FRESH);
    };
    // read once (a screen since closed), then old; and a screen holding a query it may not run
    await client.prefetchQuery({ queryKey: KEY, queryFn: count });
    client.setQueryData(KEY, HELD, { updatedAt: Date.now() - OLD_MS });
    const disabled = new QueryObserver<Board>(client, {
      queryKey: queryKeys.schedule('7d'),
      queryFn: count,
      enabled: false,
    });
    disabled.subscribe(() => undefined);
    app.go('background', 'active');
    await flush();
    expect(asked).toBe(1);
  });
});

describe('the other askers on a return join the focus refetch: one request each', () => {
  it('the live stream’s resume refetch (cancelRefetch false) and the focus manager', async () => {
    const { app, client } = wired();
    const server = heldAnswer();
    const board = heldBoard(client, OLD_MS, server.answer);
    const api = createApiClient({
      server: SERVER,
      getToken: async () => 'jwt.token.value',
      getWorkspaceId: () => WS,
      transport: fakeTransport(hangUntilAborted),
    });
    const live = createLiveController({ client: api, queryClient: client, hub: createLiveHub() });
    // as LiveEvents wires it, after the focus manager (which is wired when the client is made)
    live.setForeground(isForeground(app.source.currentState));
    app.source.addEventListener('change', (next) => live.setForeground(isForeground(next)));
    const focusRefetch = vi.spyOn(board.observer, 'refetch');
    app.go('inactive', 'background', 'active');
    await flush();
    expect(focusRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(board.asked()).toBe(1);
    server.release(FRESH);
    await flush();
    expect(board.observer.getCurrentResult().data).toEqual(FRESH);
    expect(board.asked()).toBe(1);
    live.stop();
  });

  it('a screen’s own foreground refetch that cancels (the chat thread’s) and the focus manager', async () => {
    const { app, client } = wired();
    const server = heldAnswer();
    const board = heldBoard(client, OLD_MS, server.answer);
    app.source.addEventListener('change', (next) => {
      if (next === 'active') void client.invalidateQueries({ queryKey: KEY });
    });
    const focusRefetch = vi.spyOn(board.observer, 'refetch');
    app.go('background', 'active');
    await flush();
    expect(focusRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(board.asked()).toBe(1);
    server.release(FRESH);
    await flush();
    expect(board.asked()).toBe(1);
  });
});

describe('a return racing a sign-out (clearQueryCache: cancel, then clear)', () => {
  const PERSISTER: Persister = {
    persistClient: async () => undefined,
    restoreClient: async () => undefined,
    removeClient: async () => undefined,
  };

  /** The Board held by a screen, old; each request's signal kept, each answer held back. */
  function heldWithSignals(client: QueryClient) {
    const signals: AbortSignal[] = [];
    let release: (board: Board) => void = () => undefined;
    client.setQueryData(KEY, HELD);
    new QueryObserver<Board>(client, {
      queryKey: KEY,
      queryFn: ({ signal }) => {
        signals.push(signal);
        return new Promise<Board>((resolve) => {
          release = resolve;
        });
      },
    }).subscribe(() => undefined);
    client.setQueryData(KEY, HELD, { updatedAt: Date.now() - OLD_MS });
    return { signals, release: (board: Board) => release(board) };
  }

  it('a refetch a return started is cancelled by the clear; its answer is never written', async () => {
    const { app, client } = wired();
    const board = heldWithSignals(client);
    app.go('background', 'active');
    await flush();
    expect(board.signals).toHaveLength(1);
    const clearing = clearQueryCache(client, PERSISTER);
    app.go('background', 'active'); // even a return inside the gap
    await clearing;
    board.release(FRESH);
    await flush();
    expect(board.signals.every((signal) => signal.aborted)).toBe(true);
    expect(client.getQueryData(KEY)).toBeUndefined();
    expect(client.getQueryCache().getAll()).toEqual([]);
  });

  it('after the clear, a return asks nothing, though the screen is still mounted', async () => {
    const { app, client } = wired();
    const board = heldWithSignals(client);
    await clearQueryCache(client, PERSISTER);
    app.go('background', 'active');
    await flush();
    expect(board.signals).toEqual([]);
    expect(client.getQueryCache().getAll()).toEqual([]);
  });
});

describe('the one place the app’s query client is made', () => {
  it('hands the focus manager the phone’s AppState, once, beside the client', () => {
    const root = readRepoFile('src/app-state/query-root.tsx');
    expect(root).toContain(
      'export const appQueryClient = createQueryClient();\nfollowAppFocus(AppState);',
    );
    expect(root).toContain("import { AppState } from 'react-native';");
    expect(root.match(/followAppFocus\(/g)).toHaveLength(1);
  });
});
