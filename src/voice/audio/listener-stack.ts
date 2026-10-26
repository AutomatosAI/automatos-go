// One listener at a time, kept as a stack (P001V-RVW-2): what recognizer-core.ts and speaker-core.ts
// hand their events to. Pure: no React, React Native or Expo.
//   The newest listen hears; the one it covers is told once (evicted: another screen's engine took
// the events, and it leaves as a covered screen does) before the newer one goes on top. Removing the
// top gives the events back to the one under it, which hears again without listening anew (the voice
// screen under a conversation's HUD home that was pushed over it and popped). Removing one under the
// top takes it out and leaves the top hearing; removing twice does nothing.

import { logger } from '../../lib/logger';

export type ListenerStack<E> = {
  /** `handler` hears from now on; `evicted` is told when a later push covers it. Returns the remover. */
  readonly push: (handler: (event: E) => void, evicted?: () => void) => () => void;
  /** The event to the top listener, if there is one. */
  readonly emit: (event: E) => void;
  readonly size: () => number;
};

type Entry<E> = {
  readonly handler: (event: E) => void;
  readonly evicted?: () => void;
};

/** The covered listener is told; a throw is logged, and the newer listener still goes on top. */
function tell<E>(entry: Entry<E> | undefined, name: string): void {
  try {
    entry?.evicted?.();
  } catch (error) {
    logger.warn(`[voice] the ${name}'s covered listener failed`, error);
  }
}

/** A stack for `name`'s events (the name is only for the log). */
export function createListenerStack<E>(name: string): ListenerStack<E> {
  let entries: readonly Entry<E>[] = [];

  function push(handler: (event: E) => void, evicted?: () => void): () => void {
    const entry: Entry<E> = evicted === undefined ? { handler } : { handler, evicted };
    tell(entries.at(-1), name);
    entries = [...entries, entry];
    return () => {
      entries = entries.filter((each) => each !== entry);
    };
  }

  return Object.freeze({
    push,
    emit: (event: E) => entries.at(-1)?.handler(event),
    size: () => entries.length,
  });
}
