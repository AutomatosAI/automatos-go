// AppState as the phone drives it, for tests in node: the status at setup, then each change the
// test sends to every listener, in the order they were added (as React Native's emitter does).
// iOS says 'inactive' on the way out and over a system sheet, 'background' once away, and 'active'
// at the front.

import type { AppStatusSource } from '../app-focus';

export type FakeAppState = {
  readonly source: AppStatusSource;
  /** Sends each status in turn to every listener. */
  readonly go: (...statuses: readonly string[]) => void;
};

export function fakeAppState(initial: string): FakeAppState {
  let listeners: readonly ((next: string) => void)[] = [];
  const source: AppStatusSource = {
    currentState: initial,
    addEventListener: (_type, listener) => {
      listeners = [...listeners, listener];
      return {
        remove: () => {
          listeners = listeners.filter((each) => each !== listener);
        },
      };
    },
  };
  const go = (...statuses: readonly string[]) =>
    statuses.forEach((next) => listeners.forEach((listener) => listener(next)));
  return { source, go };
}
