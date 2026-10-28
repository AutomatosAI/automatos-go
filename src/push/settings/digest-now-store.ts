// The "Send today's brief now" button's state, outside React (the phone link's small-store shape):
// the screen reads it with useSyncExternalStore, and the app's one store outlives the screen, so the
// wait after a 202 still runs when the person goes back and opens Notifications again. press() is
// the double-tap guard: its check and the switch to sending happen together, before anything is
// awaited, so a second tap in the same frame sends nothing. Pure: no React.

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
   * what came of it; null, with nothing sent, while a send is out or the wait after a 202 runs.
   * Never rejects.
   */
  press: (send: () => Promise<unknown>) => Promise<DigestNowOutcome | null>;
}>;

export function createDigestNowStore(clock: () => number = Date.now): DigestNowStore {
  let state: DigestNowState = DIGEST_NOW_IDLE;
  let listeners: readonly (() => void)[] = [];
  const set = (next: DigestNowState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const press = async (send: () => Promise<unknown>) => {
    if (!canSend(state, clock())) return null;
    set(startSending(state));
    const outcome = await answerOf(send);
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
  });
}

/** The app's one: the Notifications screen reads and presses it. */
export const digestNow: DigestNowStore = createDigestNowStore();
