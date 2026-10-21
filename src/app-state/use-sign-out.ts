// Sign out (PRD-001 §4.5): the provider ends the session and wipes the keychain (provider.signOut);
// the gate sees the session end, forgets the cached data and goes to sign-in. A failure keeps the
// person signed in and says so in the taxonomy's words; the cause goes to the dev log only. The
// expiry listener does the same when a call comes back 401 (the provider only reports it).

import { useCallback, useEffect, useState } from 'react';

import { userMessage } from '../api/errors';
import { useAuthSession } from '../auth/AuthRoot';
import type { AuthProvider } from '../auth/providers/types';
import { logger } from '../lib/logger';
import { useToast } from '../ui';

export type SignOut = {
  readonly signOut: () => void;
  readonly busy: boolean;
};

export function useSignOut(): SignOut {
  const { provider } = useAuthSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(() => {
    setBusy(true);
    provider.signOut().catch((error: unknown) => {
      logger.warn('[session] sign-out failed', error);
      toast.show(userMessage(error));
      setBusy(false);
    });
  }, [provider, toast]);
  return { signOut, busy };
}

/** A session the server no longer accepts ends here: signed out, back to sign-in. */
export function useSignOutOnExpiry(provider: AuthProvider): void {
  useEffect(
    () =>
      provider.onExpired(() => {
        provider.signOut().catch((error: unknown) => {
          logger.warn('[session] sign-out after an expired session failed', error);
        });
      }),
    [provider],
  );
}
