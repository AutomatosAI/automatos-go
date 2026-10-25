// Every response to a notification, handled once (PRD-001 §4.8): the one that launched the app
// (getLastNotificationResponse: a cold start from a tap or an action) first, then cleared so no later
// mount handles it again, then each warm tap from the response listener. It runs only inside the
// signed-in shell (PushRoot, US-014g, mounts useNotificationResponses), so a cold start's response
// is handled after sign-in, discovery and the workspace bootstrap. The handler claims a response
// before its first await, so the cold start's read and the listener's copy of it are one. Pure over
// the port: use-notification-responses.ts wires expo-router and the Toast. Never throws.

import { logger } from '../../lib/logger';
import type { NotificationsPort } from '../platform/expo';
import type { ListenerHandle } from '../platform/port';
import { handleResponse, type HandledOutcome, type HandlerDeps } from './handler';

export type ResponsesPort = Pick<
  NotificationsPort,
  | 'getLastNotificationResponse'
  | 'clearLastNotificationResponse'
  | 'addNotificationResponseReceivedListener'
  | 'dismissNotificationAsync'
>;

export type ResponsesDeps = Omit<HandlerDeps, 'port'> & Readonly<{ port: ResponsesPort }>;

export type Responses = ListenerHandle &
  Readonly<{
    /** The cold start's outcome: null when there was none, or it was handled before. */
    coldStart: Promise<HandledOutcome | null>;
  }>;

const NO_RESPONSE: Promise<null> = Promise.resolve(null);

/** The cold start's response, then cleared; a port that throws reads as none. */
function takeLastResponse(port: ResponsesPort): unknown {
  let last: unknown = null;
  try {
    last = port.getLastNotificationResponse();
  } catch {
    logger.warn('[push] could not read the notification that opened the app');
  }
  try {
    port.clearLastNotificationResponse();
  } catch {
    logger.warn('[push] could not clear the notification that opened the app');
  }
  return last;
}

function listen(deps: ResponsesDeps): ListenerHandle | null {
  try {
    return deps.port.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response, deps);
    });
  } catch {
    logger.warn('[push] could not listen for notification taps');
    return null;
  }
}

/** Handles the cold start's response and listens for warm ones; remove() stops listening. */
export function startResponses(deps: ResponsesDeps): Responses {
  const last = takeLastResponse(deps.port);
  // handleResponse claims the response synchronously, before the listener can deliver it again
  const coldStart = last == null ? NO_RESPONSE : handleResponse(last, deps);
  const listener = listen(deps);
  return Object.freeze({
    coldStart,
    remove: () => {
      try {
        listener?.remove();
      } catch {
        logger.warn('[push] could not stop listening for notification taps');
      }
    },
  });
}
