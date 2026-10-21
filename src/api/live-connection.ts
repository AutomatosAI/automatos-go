// The one live connection's lifecycle, pure (live.ts wires it to AppState and the session): ONE
// GET /api/v1/tasks/stream while the app is in the foreground, read through sse.ts. A drop or a
// server close reconnects after 1 s, 2 s, 4 s … up to 30 s (the web's use-board-event-stream.ts),
// back to 1 s once a stream opens. A refusal no retry can fix (401, 403, 404, a body that is not
// the stream) waits for the next resume instead; a 401 has already started sign-out (client.ts).
// The stream has no replay, so coming back from the background refetches what a missed event would
// have (RESUME_INVALIDATIONS) before it reconnects.

import type { QueryClient } from '@tanstack/react-query';

import { logger } from '../lib/logger';
import type { ApiClient } from './client';
import {
  invalidateFamilies,
  LIVE_INVALIDATIONS,
  parseLiveEvent,
  RESUME_INVALIDATIONS,
  type LiveHub,
} from './live-events';
import { isRetryable } from './query-client';
import { routes } from './routes';
import { readEvents, type ServerEvent } from './sse';

/** The first reconnect waits this long; each failure in a row doubles it. */
export const LIVE_RECONNECT_MIN_MS = 1_000;
/** No reconnect waits longer than this. */
export const LIVE_RECONNECT_MAX_MS = 30_000;

/** The wait before reconnect number `attempt` (0-based): 1 s, 2 s, 4 s … capped at 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(LIVE_RECONNECT_MIN_MS * 2 ** Math.max(0, attempt), LIVE_RECONNECT_MAX_MS);
}

/** setTimeout / clearTimeout, injected so the tests drive time. */
export type LiveTimers = {
  readonly set: (run: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
};

const SYSTEM_TIMERS: LiveTimers = Object.freeze({
  set: (run: () => void, ms: number) => setTimeout(run, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export type ReconnectScheduler = {
  /** Runs `run` after the next backoff delay (replacing one already waiting); returns the delay. */
  readonly schedule: (run: () => void) => number;
  /** A stream opened: the next drop waits the minimum again. */
  readonly reset: () => void;
  /** Drops the waiting reconnect, if any. */
  readonly cancel: () => void;
};

export function createReconnectScheduler(timers: LiveTimers = SYSTEM_TIMERS): ReconnectScheduler {
  let attempt = 0;
  let waiting: unknown = null;
  const cancel = () => {
    if (waiting !== null) timers.clear(waiting);
    waiting = null;
  };
  return Object.freeze({
    schedule: (run: () => void) => {
      cancel();
      const delay = reconnectDelay(attempt);
      attempt += 1;
      waiting = timers.set(() => {
        waiting = null;
        run();
      }, delay);
      return delay;
    },
    reset: () => {
      attempt = 0;
    },
    cancel,
  });
}

/** AppState's status: 'background' (and an iOS extension's) is away; anything else is on screen. */
export function isForeground(appState: string): boolean {
  return appState !== 'background' && appState !== 'extension';
}

export type LiveControllerOptions = {
  readonly client: Pick<ApiClient, 'stream'>;
  readonly queryClient: Pick<QueryClient, 'invalidateQueries'>;
  readonly hub: LiveHub;
  readonly timers?: LiveTimers;
};

export type LiveController = {
  /** AppState's foreground or not; the first true connects, later ones are resumes. */
  readonly setForeground: (foreground: boolean) => void;
  /** Signed out or unmounted: closes the stream for good. */
  readonly stop: () => void;
};

/** Each frame: unknown ones are ignored; the rest refetch their families and reach subscribers. */
function eventHandler(options: LiveControllerOptions): (event: ServerEvent) => void {
  return (event) => {
    const live = parseLiveEvent(event);
    if (!live) {
      logger.debug(`[live] ignored a ${event.event} frame this version does not read`);
      return;
    }
    void invalidateFamilies(options.queryClient, LIVE_INVALIDATIONS[live.type]);
    options.hub.emit(live);
  };
}

/** Reads one stream to its end; true when a reconnect may help. */
async function readOnce(
  options: LiveControllerOptions,
  scheduler: ReconnectScheduler,
  controller: AbortController,
): Promise<boolean> {
  const opened = () => {
    scheduler.reset();
    options.hub.setStatus('live');
  };
  try {
    const onEvent = eventHandler(options);
    await readEvents(options.client, routes.tasksStream, onEvent, controller.signal, opened);
    return true;
  } catch (error) {
    if (controller.signal.aborted) return false;
    logger.warn('[live] the event stream failed', error);
    return isRetryable(error);
  }
}

export function createLiveController(options: LiveControllerOptions): LiveController {
  const scheduler = createReconnectScheduler(options.timers);
  let foreground = false;
  let wasAway = false;
  let stopped = false;
  /** The one open stream's abort; null while none is open. */
  let open: AbortController | null = null;

  const connect = async (): Promise<void> => {
    if (stopped || !foreground || open) return;
    const controller = new AbortController();
    open = controller;
    options.hub.setStatus('connecting');
    const retry = await readOnce(options, scheduler, controller);
    if (controller.signal.aborted) return; // disconnect() has already settled the state
    open = null;
    options.hub.setStatus('offline');
    if (retry) scheduler.schedule(() => void connect());
  };

  const disconnect = () => {
    scheduler.cancel();
    open?.abort();
    open = null;
    options.hub.setStatus('offline');
  };

  return Object.freeze({
    setForeground: (next: boolean) => {
      if (stopped || next === foreground) return;
      foreground = next;
      if (!next) {
        wasAway = true;
        disconnect();
        return;
      }
      if (wasAway) void invalidateFamilies(options.queryClient, RESUME_INVALIDATIONS);
      scheduler.reset();
      void connect();
    },
    stop: () => {
      stopped = true;
      foreground = false;
      disconnect();
    },
  });
}
