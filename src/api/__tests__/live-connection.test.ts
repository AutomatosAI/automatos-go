import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { createApiClient } from '../client';
import {
  createLiveController,
  createReconnectScheduler,
  isForeground,
  LIVE_RECONNECT_MAX_MS,
  LIVE_RECONNECT_MIN_MS,
  reconnectDelay,
  type LiveTimers,
} from '../live-connection';
import { createLiveHub, type LiveStatus } from '../live-events';
import { queryKeys } from '../query-keys';
import type { StreamingResponse, TransportRequest } from '../transport-types';
import {
  SERVER,
  chunked,
  fakeTransport,
  flush,
  hangUntilAborted,
  jsonReply,
  PENDING,
} from './fake-transport';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Timers the test fires by hand: each waiting reconnect and its delay. */
function manualTimers() {
  let waiting: { run: () => void; ms: number; handle: number }[] = [];
  let next = 0;
  const timers: LiveTimers = {
    set: (run, ms) => {
      next += 1;
      waiting = [...waiting, { run, ms, handle: next }];
      return next;
    },
    clear: (handle) => {
      waiting = waiting.filter((entry) => entry.handle !== handle);
    },
  };
  return {
    timers,
    delays: () => waiting.map((entry) => entry.ms),
    fire: () => {
      const [first, ...rest] = waiting;
      waiting = rest;
      first?.run();
    },
  };
}

type Answer = (request: TransportRequest) => StreamingResponse | Promise<StreamingResponse>;

/** A controller over a fake server that answers each connect with the next of `answers`. */
function harness(answers: readonly Answer[]) {
  let index = 0;
  const transport = fakeTransport((request) => {
    const answer = answers[Math.min(index, answers.length - 1)];
    index += 1;
    return answer(request);
  });
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WS,
    transport,
  });
  const queryClient = new QueryClient();
  const hub = createLiveHub();
  const statuses: LiveStatus[] = [];
  hub.onStatus(() => statuses.push(hub.status()));
  const clock = manualTimers();
  const controller = createLiveController({ client, queryClient, hub, timers: clock.timers });
  return { transport, queryClient, hub, statuses, clock, controller };
}

const openForever: Answer = () => chunked([frame('board_changed', { workspace_id: WS }), PENDING]);
const dropsAfterOpening: Answer = () => chunked([new Error('socket closed')]);
const unreachable: Answer = () => Promise.reject(new TypeError('Network request failed'));
const hangs: Answer = (request) => hangUntilAborted(request);

describe('the reconnect backoff (1 s → 30 s)', () => {
  it('doubles from 1 s and stops at 30 s', () => {
    expect(LIVE_RECONNECT_MIN_MS).toBe(1_000);
    expect(LIVE_RECONNECT_MAX_MS).toBe(30_000);
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(reconnectDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
    expect(reconnectDelay(-1)).toBe(1_000);
  });

  it('schedules each reconnect one step longer, until a stream opens', () => {
    const clock = manualTimers();
    const scheduler = createReconnectScheduler(clock.timers);
    const run = vi.fn();
    expect([1, 2, 3].map(() => scheduler.schedule(run))).toEqual([1_000, 2_000, 4_000]);
    expect(clock.delays()).toEqual([4_000]);
    scheduler.reset();
    expect(scheduler.schedule(run)).toBe(1_000);
    clock.fire();
    expect(run).toHaveBeenCalledOnce();
  });

  it('runs nothing once cancelled', () => {
    const clock = manualTimers();
    const scheduler = createReconnectScheduler(clock.timers);
    const run = vi.fn();
    scheduler.schedule(run);
    scheduler.cancel();
    clock.fire();
    expect(run).not.toHaveBeenCalled();
    expect(clock.delays()).toEqual([]);
  });

  it('uses the system timers by default', () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      createReconnectScheduler().schedule(run);
      vi.advanceTimersByTime(LIVE_RECONNECT_MIN_MS);
      expect(run).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AppState → foreground', () => {
  it('is away only in the background (or an iOS extension)', () => {
    expect(['active', 'inactive', 'unknown'].map(isForeground)).toEqual([true, true, true]);
    expect(['background', 'extension'].map(isForeground)).toEqual([false, false]);
  });
});

describe('the live controller', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('opens ONE GET /api/v1/tasks/stream with the bearer, and goes live', async () => {
    const live = harness([openForever]);
    live.controller.setForeground(true);
    live.controller.setForeground(true);
    await flush();
    expect(live.transport.calls).toHaveLength(1);
    expect(live.transport.calls[0]).toMatchObject({
      url: 'https://api.example.test/api/v1/tasks/stream',
      method: 'GET',
      headers: { Authorization: 'Bearer jwt.token.value', 'X-Workspace-ID': WS },
    });
    expect(live.statuses).toEqual(['connecting', 'live']);
    live.controller.stop();
  });

  it('refetches on board_changed and fans chat_changed out to subscribers', async () => {
    const chat = { workspace_id: WS, chat_id: 'c-9', user_id: 3, event: 'chat_changed' };
    const live = harness([
      () =>
        chunked([
          frame('board_changed', { workspace_id: WS, task_id: 4, status: 'review' }),
          frame('chat_changed', chat),
          frame('agent_moved', { workspace_id: WS }),
          PENDING,
        ]),
    ]);
    live.queryClient.setQueryData(queryKeys.needsYou(), { total: 1 });
    live.queryClient.setQueryData(queryKeys.chat.history(), []);
    const onChat = vi.fn();
    live.hub.on('chat_changed', onChat);
    live.controller.setForeground(true);
    await flush();
    expect(live.queryClient.getQueryState(queryKeys.needsYou())?.isInvalidated).toBe(true);
    expect(live.queryClient.getQueryState(queryKeys.chat.history())?.isInvalidated).toBe(false);
    expect(onChat).toHaveBeenCalledOnce();
    expect(onChat).toHaveBeenCalledWith(chat);
    live.controller.stop();
  });

  it('reconnects after 1 s, 2 s … while the server is unreachable, back to 1 s once open', async () => {
    const live = harness([unreachable, unreachable, dropsAfterOpening, openForever]);
    live.controller.setForeground(true);
    await flush();
    expect(live.clock.delays()).toEqual([1_000]);
    live.clock.fire();
    await flush();
    expect(live.clock.delays()).toEqual([2_000]);
    live.clock.fire();
    await flush();
    // that one opened, then dropped: the backoff starts again
    expect(live.clock.delays()).toEqual([1_000]);
    live.clock.fire();
    await flush();
    expect(live.transport.calls).toHaveLength(4);
    expect(live.statuses.at(-1)).toBe('live');
    live.controller.stop();
  });

  it('reconnects when the server ends the stream', async () => {
    const live = harness([() => chunked([frame('board_changed', { workspace_id: WS })])]);
    live.controller.setForeground(true);
    await flush();
    expect(live.statuses).toEqual(['connecting', 'live', 'offline']);
    expect(live.clock.delays()).toEqual([1_000]);
    live.controller.stop();
  });

  it('waits for the next resume after a refusal no retry fixes (401, 403)', async () => {
    for (const status of [401, 403]) {
      const live = harness([() => jsonReply(status, { detail: 'no' }), openForever]);
      live.controller.setForeground(true);
      await flush();
      expect(live.clock.delays()).toEqual([]);
      expect(live.hub.status()).toBe('offline');
      expect(warn).toHaveBeenLastCalledWith('[live] the event stream failed', expect.anything());
      live.controller.setForeground(false);
      live.controller.setForeground(true);
      await flush();
      expect(live.transport.calls).toHaveLength(2);
      expect(live.hub.status()).toBe('live');
      live.controller.stop();
    }
  });

  it('closes in the background; on resume refetches (no replay), then reopens', async () => {
    const live = harness([openForever]);
    live.queryClient.setQueryData(queryKeys.board(), []);
    live.controller.setForeground(true);
    await flush();
    live.queryClient.setQueryData(queryKeys.board(), []); // fresh again after the connect frame
    expect(live.queryClient.getQueryState(queryKeys.board())?.isInvalidated).toBe(false);

    live.controller.setForeground(false);
    expect(live.hub.status()).toBe('offline');
    expect(live.transport.calls[0].signal.aborted).toBe(true);

    live.controller.setForeground(true);
    expect(live.queryClient.getQueryState(queryKeys.board())?.isInvalidated).toBe(true);
    await flush();
    expect(live.transport.calls).toHaveLength(2);
    expect(live.hub.status()).toBe('live');
    live.controller.stop();
  });

  it('does not refetch on the first foreground (nothing was missed)', async () => {
    const live = harness([hangs]);
    live.queryClient.setQueryData(queryKeys.board(), []);
    live.controller.setForeground(true);
    expect(live.queryClient.getQueryState(queryKeys.board())?.isInvalidated).toBe(false);
    live.controller.stop();
  });

  it('drops a waiting reconnect in the background', async () => {
    const live = harness([unreachable]);
    live.controller.setForeground(true);
    await flush();
    expect(live.clock.delays()).toEqual([1_000]);
    live.controller.setForeground(false);
    expect(live.clock.delays()).toEqual([]);
  });

  it('closes for good on stop: no reconnect, no resume', async () => {
    const live = harness([hangs]);
    live.controller.setForeground(true);
    await flush();
    live.controller.stop();
    await flush();
    expect(live.transport.calls[0].signal.aborted).toBe(true);
    expect(live.clock.delays()).toEqual([]);
    live.controller.setForeground(true);
    await flush();
    expect(live.transport.calls).toHaveLength(1);
    expect(live.hub.status()).toBe('offline');
  });
});
