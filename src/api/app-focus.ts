// TanStack's focus, from the app coming back to the front (rule 6.4). On a phone, an app that
// returns from the background is not a mount: unless something asks the server again, a screen can
// show hours-old data with no out-of-date line, because no refresh was tried and so none failed.
// Wired once, where the app's query client is made (src/app-state/query-root.tsx): on a return,
// every query a screen holds that is stale (older than QUERY_STALE_TIME_MS, or invalidated) asks
// again; a fresh one, a disabled one and one no screen holds do not, nor one with a rule of its own
// for a return (refetchOnWindowFocus: false: the gate's workspace query). TanStack's focus refetch
// never cancels one in flight, it joins it, so the live stream's resume refetch
// (live-connection.ts) and this cost one request. While the app is away, TanStack also holds its polling and its retries
// until the return. 'inactive' is not away: a permission prompt, Face ID or the app switcher half
// open passes over an app that never left, so it asks nothing. Pure: AppState is handed in.

import { focusManager } from '@tanstack/react-query';

import { isForeground } from './live-connection';

/** AppState's status for the app on screen and in use. */
const ACTIVE = 'active';
/** iOS: a system sheet over the app. It never left, so the next change is judged from before it. */
const PASSING = 'inactive';
/** AppState's status before the phone has said where the app is (React Native's own word). */
const NOT_YET_SAID = 'unknown';

/** The phone's AppState as this reads it: the status now, and each change. */
export type AppStatusSource = {
  readonly currentState: string;
  readonly addEventListener: (
    type: 'change',
    listener: (next: string) => void,
  ) => { readonly remove: () => void };
};

/**
 * True when the app is back at the front: 'active' after the background (or an iOS extension), or
 * at launch, before any status (null, 'unknown'). 'active' after 'inactive' or 'active' is not.
 */
export function returnedToFront(previous: string | null, next: string): boolean {
  if (next !== ACTIVE) return false;
  return previous === null || previous === NOT_YET_SAID || !isForeground(previous);
}

/** The status the next change is judged from: a passing 'inactive' keeps where the app was. */
export function judgedFrom(previous: string | null, next: string): string | null {
  return next === PASSING ? previous : next;
}

type SetFocused = (focused?: boolean) => void;

/** focusManager's setup over this AppState: focused on a return, unfocused away, else nothing. */
export function appFocusSetup(appState: AppStatusSource): (setFocused: SetFocused) => () => void {
  return (setFocused) => {
    let previous = judgedFrom(null, appState.currentState);
    const subscription = appState.addEventListener('change', (next) => {
      if (returnedToFront(previous, next)) setFocused(true);
      else if (!isForeground(next)) setFocused(false);
      previous = judgedFrom(previous, next);
    });
    return () => subscription.remove();
  };
}

/** Hands TanStack's one focus manager this AppState. Called once, beside the app's query client. */
export function followAppFocus(appState: AppStatusSource): void {
  focusManager.setEventListener(appFocusSetup(appState));
}
