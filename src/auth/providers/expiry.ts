// The expired signal a provider's onExpired listens on: the API client's onAuthExpired (a 401 from
// Automatos) and the provider itself (its sign-in service refusing the session) both notify it, and
// every listener hears it (the shell sends the user back to sign-in). One listener failing never
// stops the others hearing it.

import { logger } from '../../lib/logger';
import type { ExpiredListener } from './types';

export type ExpirySignal = {
  readonly subscribe: (listener: ExpiredListener) => () => void;
  readonly notify: () => void;
};

export function createExpirySignal(): ExpirySignal {
  let listeners: readonly ExpiredListener[] = [];
  return Object.freeze({
    subscribe: (listener: ExpiredListener) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    notify: () => {
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          logger.error('[auth] an expired-session listener failed', error);
        }
      }
    },
  });
}
