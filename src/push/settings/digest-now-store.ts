// The "Send today's brief now" button's state, outside React (the phone link's small-store shape):
// the screen reads it with useSyncExternalStore, and the app's one store outlives the screen, so a
// wait still runs when the person goes back and opens Notifications again. press() is the double-tap
// guard: its check and the switch to sending happen together, before anything is awaited, so a
// second tap in the same frame sends nothing. reset() is the leaving's (src/connect/switch.ts
// clearUserData, every way out): nothing of one person's wait reaches the next, not even the answer
// to a POST still out when they left. Pure: no React.

import {
  DIGEST_NOW_IDLE,
  afterAnswer,
  answerOf,
  canSend,
  startSending,
  type DigestNowOutcome,
  type DigestNowState,
} from './digest-now';

export type DigestNowStore = Readonly<{
  current: () => DigestNowState;
  subscribe: (listener: () => void) => () => void;
  /**
   * Sends once through `send` (it resolves on a 202 and rejects with the client's error) and answers
   * what came of it; null, with nothing sent, while a send is out or a wait runs, and null for an
   * answer that lands after reset(). Never rejects.
   */
  press: (send: () => Promise<unknown>) => Promise<DigestNowOutcome | null>;
  /** Back to idle: no wait, no line, and any answer still out is dropped. */
  reset: () => void;
}>;

export function createDigestNowStore(clock: () => number = Date.now): DigestNowStore {
  let state: DigestNowState = DIGEST_NOW_IDLE;
  let listeners: readonly (() => void)[] = [];
  // bumped by reset(): an answer sent before it belongs to the session that was left
  let session = 0;
  const set = (next: DigestNowState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const press = async (send: () => Promise<unknown>) => {
    if (!canSend(state, clock())) return null;
    const sentIn = session;
    set(startSending(state));
    const outcome = await answerOf(send);
    if (sentIn !== session) return null;
    set(afterAnswer(state, outcome, clock()));
    return outcome;
  };
  return Object.freeze({
    current: () => state,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    press,
    reset: () => {
      session += 1;
      set(DIGEST_NOW_IDLE);
    },
  });
}

/** The app's one: the Notifications screen reads and presses it. */
export const digestNow: DigestNowStore = createDigestNowStore();
