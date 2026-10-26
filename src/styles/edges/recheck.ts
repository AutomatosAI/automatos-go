// Not running's quiet re-check (US-017f, Ember 07: 'Play also checks every 5 seconds'), pure: a
// timeout chain, not an interval — the next check is set NOT_RUNNING_RECHECK_MS after the last one
// settled, so a slow check never stacks a second on top of it — that stops for good on stop() (the
// screen going away). Each check is handed a 'still running' test that turns false on stop(), so a
// check still out when the screen goes can drop its answer instead of acting on a screen that is
// gone. A check that throws or rejects is logged and the chain goes on: the screen's own Check
// again still works. The clock is injected so the tests drive it.

import { logger } from '../../lib/logger';

/** How long Not running waits between quiet checks. */
export const NOT_RUNNING_RECHECK_MS = 5_000;

export type RecheckClock = {
  readonly setTimeout: (run: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

const SYSTEM_CLOCK: RecheckClock = Object.freeze({
  setTimeout: (run: () => void, ms: number) => setTimeout(run, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export type RecheckOptions = {
  readonly every?: number;
  readonly clock?: RecheckClock;
};

export type Recheck = { readonly stop: () => void };

/** True until the chain is stopped: a check that settles later reads it before acting. */
export type StillRunning = () => boolean;

/** What a check may answer: nothing, or a promise the chain waits for before the next. */
export type RecheckRun = (running: StillRunning) => void | Promise<unknown>;

function runOnce(check: RecheckRun, running: StillRunning): Promise<unknown> {
  try {
    return Promise.resolve(check(running));
  } catch (error) {
    return Promise.reject(error);
  }
}

/** Checks every `every` ms (5 s) after the last check settled, until stop(). */
export function startRecheck(check: RecheckRun, options: RecheckOptions = {}): Recheck {
  const { every = NOT_RUNNING_RECHECK_MS, clock = SYSTEM_CLOCK } = options;
  const chain = { stopped: false, handle: null as unknown };
  const running: StillRunning = () => !chain.stopped;

  const schedule = (): void => {
    if (chain.stopped) return;
    chain.handle = clock.setTimeout(tick, every);
  };
  const tick = (): void => {
    chain.handle = null;
    if (chain.stopped) return;
    runOnce(check, running)
      .catch((error: unknown) => logger.warn('[edges] the quiet re-check failed', error))
      .finally(schedule);
  };

  schedule();
  return Object.freeze({
    stop: () => {
      chain.stopped = true;
      if (chain.handle !== null) clock.clearTimeout(chain.handle);
      chain.handle = null;
    },
  });
}
