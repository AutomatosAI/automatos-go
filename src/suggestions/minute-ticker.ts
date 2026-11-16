// One clock for every surface that shows suggestions (use-suggestions.ts): it ticks at each turn of
// the minute while anything reads it, and stops when nothing does. The Command Centre's
// useMinuteClock keeps a timer in each component that reads it; the seven surfaces that show
// suggestions share this one instead. Pure: the time and the timers are handed in, so the tests
// drive them.

import { msUntilNextMinute } from '../cc/shell/dateline';

const MINUTE_MS = 60_000;

export type TickerClock = {
  readonly now: () => number;
  readonly set: (run: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
};

const SYSTEM_CLOCK: TickerClock = Object.freeze({
  now: () => Date.now(),
  set: (run: () => void, ms: number) => setTimeout(run, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export type MinuteTicker = {
  /** useSyncExternalStore's subscribe: the listener runs at each turn of the minute. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The minute it is now (minutes since the epoch): it changes only when the minute turns. */
  readonly minute: () => number;
};

export function createMinuteTicker(clock: TickerClock = SYSTEM_CLOCK): MinuteTicker {
  let listeners: readonly (() => void)[] = [];
  let waiting: unknown = null;
  const arm = (): void => {
    waiting = clock.set(
      () => {
        waiting = null;
        listeners.forEach((listener) => listener());
        if (listeners.length > 0) arm();
      },
      msUntilNextMinute(new Date(clock.now())),
    );
  };
  return Object.freeze({
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      if (waiting === null) arm();
      return () => {
        listeners = listeners.filter((each) => each !== listener);
        if (listeners.length > 0 || waiting === null) return;
        clock.clear(waiting);
        waiting = null;
      };
    },
    minute: () => Math.floor(clock.now() / MINUTE_MS),
  });
}
