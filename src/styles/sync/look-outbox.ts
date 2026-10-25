// One look save at a time (US-017d; behaviour reference play-look-state.ts createLookOutbox at the
// pin): two PUTs in flight can be handled in either order (the server runs each in its own thread
// and a PUT replaces the whole set), so an older one landing last would put back what a newer one
// replaced. Saves run in the order they were queued, each once the ones before it have their
// answers; a save still waiting when a newer one is queued under the same key (a theme and a
// session) is dropped, because the newer one carries the whole set. Each queued save's promise
// settles (never rejects) when its turn is over: answered, failed or dropped, so a caller can tell
// whether a save is still outstanding. Pure (no React, no timers).

import { logger } from '../../lib/logger';

export type LookOutbox = {
  /** Queues `send` under `key`; it runs once the saves before it have their answers. */
  readonly queue: (key: string, send: () => Promise<unknown>) => Promise<void>;
};

export function createLookOutbox(): LookOutbox {
  let tail: Promise<unknown> = Promise.resolve();
  let queued = 0;
  /** Saves queued and not answered yet: at 0 a new save has nothing before it and starts now. */
  let unanswered = 0;
  const newest = new Map<string, number>();
  return Object.freeze({
    queue: (key: string, send: () => Promise<unknown>) => {
      queued += 1;
      const ticket = queued;
      newest.set(key, ticket);
      const run = () => (newest.get(key) === ticket ? send() : undefined);
      // started now when idle (a newer save queued in the same tick then waits behind it, never
      // drops it); otherwise once the saves before it have their answers
      const started =
        unanswered === 0 ? new Promise<unknown>((resolve) => resolve(run())) : tail.then(run);
      unanswered += 1;
      tail = started
        .catch((error: unknown) => logger.warn("[styles] a look save's answer was not handled", error))
        .finally(() => {
          unanswered -= 1;
        });
      return tail.then(() => undefined);
    },
  });
}
